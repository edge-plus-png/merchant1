const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const COOKIE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const GATEWAY_CONTROL_HEADERS = new Set([
  "x-vercel-protection-bypass",
  "x-vercel-set-bypass-cookie",
]);

export class GatewayError extends Error {
  constructor(status = 502) {
    super("Application gateway request failed.");
    this.name = "GatewayError";
    this.status = status;
  }
}

function cleanOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new GatewayError();
  }
  return url.origin;
}

export function parseGatewayConfig(environment = process.env) {
  const portalCookieNames = String(environment.PORTAL_COOKIE_NAMES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    portalCookieNames.length === 0 ||
    portalCookieNames.some((name) => !COOKIE_NAME_PATTERN.test(name)) ||
    String(environment.APPLICATION_GATEWAY_SHARED_SECRET ?? "").length < 32
  ) {
    throw new GatewayError(503);
  }
  const portalProtectionBypass = String(
    environment.PORTAL_PROTECTION_BYPASS_SECRET ?? "",
  ).trim();
  if (
    portalProtectionBypass &&
    !/^[A-Za-z0-9_-]{32,128}$/.test(portalProtectionBypass)
  ) {
    throw new GatewayError(503);
  }

  return {
    portalUpstreamOrigin: cleanOrigin(
      String(environment.PORTAL_UPSTREAM_ORIGIN ?? ""),
    ),
    portalPublicOrigin: cleanOrigin(
      String(environment.PORTAL_PUBLIC_ORIGIN ?? ""),
    ),
    portalCookieNames,
    portalProtectionBypass: portalProtectionBypass || null,
    sharedSecret: String(environment.APPLICATION_GATEWAY_SHARED_SECRET),
  };
}

export function classifyRoute(pathname) {
  const assetMatch = pathname.match(
    /^\/_getedge\/capability-assets\/([^/]+)(\/.*)?$/,
  );
  if (assetMatch && SLUG_PATTERN.test(assetMatch[1])) {
    return {
      kind: "capability-asset",
      slug: assetMatch[1],
      upstreamPath: pathname,
    };
  }

  const applicationMatch = pathname.match(/^\/apps\/([^/]+)(\/.*)?$/);
  if (!applicationMatch || !SLUG_PATTERN.test(applicationMatch[1])) {
    return { kind: "portal" };
  }

  const slug = applicationMatch[1];
  const remainder = applicationMatch[2];
  if (!remainder) return { kind: "portal" };
  if (remainder === "/__launch") {
    return { kind: "capability-launch", slug, upstreamPath: "/api/portal-launch" };
  }
  return { kind: "capability-page", slug, upstreamPath: remainder };
}

function validateRoutingRecord(value, slug) {
  if (
    !value ||
    typeof value !== "object" ||
    value.available !== true ||
    value.slug !== slug ||
    !SLUG_PATTERN.test(value.slug) ||
    !value.portalRouting ||
    value.portalRouting.version !== 1 ||
    !value.portalRouting.sessionCookie ||
    !COOKIE_NAME_PATTERN.test(value.portalRouting.sessionCookie.name) ||
    value.portalRouting.assetPrefix !==
      `/_getedge/capability-assets/${slug}`
  ) {
    throw new GatewayError(404);
  }

  const applicationOrigin = cleanOrigin(value.applicationOrigin);
  const launchUrl = new URL(value.launchUrl);
  if (
    launchUrl.origin !== applicationOrigin ||
    launchUrl.pathname !== "/api/portal-launch" ||
    launchUrl.search ||
    launchUrl.hash ||
    (value.environment !== "staging" && value.environment !== "production")
  ) {
    throw new GatewayError(404);
  }

  return {
    slug,
    applicationOrigin,
    launchUrl: launchUrl.toString(),
    environment: value.environment,
    sessionCookieName: value.portalRouting.sessionCookie.name,
    assetPrefix: value.portalRouting.assetPrefix,
  };
}

function filterCookieHeader(header, permittedNames) {
  const permitted = new Set(permittedNames);
  return String(header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => permitted.has(part.slice(0, part.indexOf("="))))
    .join("; ");
}

function proxyHeaders(
  request,
  cookieNames,
  browserOrigin,
  upstreamRequestOrigin,
) {
  const headers = new Headers();
  for (const [name, value] of request.headers) {
    const lower = name.toLowerCase();
    if (
      !HOP_BY_HOP_HEADERS.has(lower) &&
      !GATEWAY_CONTROL_HEADERS.has(lower) &&
      lower !== "cookie"
    ) {
      headers.append(name, value);
    }
  }
  const cookies = filterCookieHeader(request.headers.get("cookie"), cookieNames);
  if (cookies) headers.set("cookie", cookies);
  headers.set("x-forwarded-host", new URL(upstreamRequestOrigin).host);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-getedge-browser-origin", browserOrigin);
  headers.set("accept-encoding", "identity");
  return headers;
}

async function resolveCapability(slug, config, fetcher) {
  const url = new URL(
    `/api/internal/application-routing/${encodeURIComponent(slug)}`,
    config.portalUpstreamOrigin,
  );
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${config.sharedSecret}`,
    "X-Forwarded-Host": new URL(config.portalPublicOrigin).host,
    "X-Forwarded-Proto": "https",
  };
  if (config.portalProtectionBypass) {
    headers["X-Vercel-Protection-Bypass"] = config.portalProtectionBypass;
  }
  const response = await fetcher(url, {
    cache: "no-store",
    headers,
    redirect: "manual",
  });
  if (!response.ok) throw new GatewayError(404);
  return validateRoutingRecord(await response.json(), slug);
}

function getRequestBody(request) {
  return request.method === "GET" || request.method === "HEAD"
    ? undefined
    : request.body;
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

export function scopeCapabilityCookie(value, routing) {
  const [pair, ...attributes] = value.split(";").map((part) => part.trim());
  const separator = pair.indexOf("=");
  if (separator < 1 || pair.slice(0, separator) !== routing.sessionCookieName) {
    return null;
  }

  const preserved = attributes.filter((attribute) =>
    /^(?:expires=|max-age=)/i.test(attribute),
  );
  return [
    pair,
    ...preserved,
    `Path=/apps/${routing.slug}/`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function rewriteLocation(value, routing, publicOrigin) {
  const location = new URL(value, routing.applicationOrigin);
  if (location.origin !== routing.applicationOrigin) return value;
  const destination = new URL(
    `/apps/${routing.slug}${location.pathname}${location.search}${location.hash}`,
    publicOrigin,
  );
  return destination.toString();
}

function rewriteCsp(value, routing, publicOrigin) {
  const applicationPath = `${publicOrigin}/apps/${routing.slug}/`;
  const assetPath = `${publicOrigin}${routing.assetPrefix}/`;
  const sourcesByDirective = {
    "default-src": [applicationPath, assetPath],
    "connect-src": [applicationPath, assetPath],
    "font-src": [assetPath],
    "form-action": [applicationPath],
    "img-src": [applicationPath, assetPath],
    "media-src": [applicationPath, assetPath],
    "script-src": [assetPath],
    "style-src": [assetPath],
  };
  const directives = value
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean)
    .map((directive) => {
      const [name, ...sources] = directive.split(/\s+/);
      const replacements = sourcesByDirective[name];
      if (!replacements || !sources.includes("'self'")) return directive;
      return [
        name,
        ...sources.flatMap((source) =>
          source === "'self'" ? replacements : [source],
        ),
      ].join(" ");
    });
  const names = new Set(directives.map((directive) => directive.split(/\s+/)[0]));
  if (!names.has("frame-ancestors") || !names.has("form-action") || !names.has("script-src")) {
    throw new GatewayError();
  }
  return directives.join("; ");
}

function capabilityCsp(routing, publicOrigin) {
  const applicationPath = `${publicOrigin}/apps/${routing.slug}/`;
  const assetPath = `${publicOrigin}${routing.assetPrefix}/`;
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    `form-action ${applicationPath}`,
    `script-src ${assetPath} 'unsafe-inline'`,
    "script-src-attr 'none'",
    `style-src ${assetPath} 'unsafe-inline'`,
    `connect-src ${applicationPath} ${assetPath}`,
    `img-src ${applicationPath} ${assetPath} data: blob:`,
    `font-src ${assetPath} data:`,
    `media-src ${applicationPath} ${assetPath} blob:`,
    `manifest-src ${assetPath}`,
    "worker-src blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

async function capabilityResponse(upstream, routing, publicOrigin, routeKind) {
  const headers = new Headers();
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (
      !HOP_BY_HOP_HEADERS.has(lower) &&
      lower !== "content-encoding" &&
      lower !== "set-cookie" &&
      lower !== "location"
    ) {
      headers.append(name, value);
    }
  }

  const scopedCookies = getSetCookies(upstream.headers)
    .map((cookie) => scopeCapabilityCookie(cookie, routing))
    .filter(Boolean);
  for (const cookie of scopedCookies) headers.append("set-cookie", cookie);

  const location = upstream.headers.get("location");
  if (location) headers.set("location", rewriteLocation(location, routing, publicOrigin));

  const csp = upstream.headers.get("content-security-policy");
  if (routeKind === "capability-page" || routeKind === "capability-launch") {
    headers.set(
      "content-security-policy",
      csp
        ? rewriteCsp(csp, routing, publicOrigin)
        : capabilityCsp(routing, publicOrigin),
    );
    headers.set("cache-control", "private, no-store");
  }
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function portalResponse(upstream, config) {
  const headers = new Headers();
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (
      !HOP_BY_HOP_HEADERS.has(lower) &&
      lower !== "content-encoding" &&
      lower !== "set-cookie" &&
      lower !== "location"
    ) {
      headers.append(name, value);
    }
  }

  const permittedCookieNames = new Set(config.portalCookieNames);
  for (const cookie of getSetCookies(upstream.headers)) {
    const separator = cookie.indexOf("=");
    if (separator > 0 && permittedCookieNames.has(cookie.slice(0, separator))) {
      headers.append("set-cookie", cookie);
    }
  }

  const locationValue = upstream.headers.get("location");
  if (locationValue) {
    const location = new URL(locationValue, config.portalUpstreamOrigin);
    if (location.origin === config.portalUpstreamOrigin) {
      location.protocol = new URL(config.portalPublicOrigin).protocol;
      location.host = new URL(config.portalPublicOrigin).host;
    }
    headers.set("location", location.toString());
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function proxyPortal(request, config, fetcher) {
  const incoming = new URL(request.url);
  const destination = new URL(`${incoming.pathname}${incoming.search}`, config.portalUpstreamOrigin);
  const headers = proxyHeaders(
    request,
    config.portalCookieNames,
    config.portalPublicOrigin,
    config.portalPublicOrigin,
  );
  if (config.portalProtectionBypass) {
    headers.set(
      "x-vercel-protection-bypass",
      config.portalProtectionBypass,
    );
  }
  const response = await fetcher(destination, {
    body: getRequestBody(request),
    cache: "no-store",
    headers,
    method: request.method,
    redirect: "manual",
    duplex: getRequestBody(request) ? "half" : undefined,
  });
  return portalResponse(response, config);
}

async function proxyCapability(request, route, config, fetcher) {
  const routing = await resolveCapability(route.slug, config, fetcher);
  const incoming = new URL(request.url);
  const destination = new URL(
    `${route.upstreamPath}${incoming.search}`,
    routing.applicationOrigin,
  );
  const response = await fetcher(destination, {
    body: getRequestBody(request),
    cache: "no-store",
    headers: proxyHeaders(
      request,
      [routing.sessionCookieName],
      config.portalPublicOrigin,
      routing.applicationOrigin,
    ),
    method: request.method,
    redirect: "manual",
    duplex: getRequestBody(request) ? "half" : undefined,
  });
  return capabilityResponse(
    response,
    routing,
    config.portalPublicOrigin,
    route.kind,
  );
}

export async function handleGatewayRequest(
  request,
  config = parseGatewayConfig(),
  fetcher = fetch,
) {
  try {
    const route = classifyRoute(new URL(request.url).pathname);
    return route.kind === "portal"
      ? await proxyPortal(request, config, fetcher)
      : await proxyCapability(request, route, config, fetcher);
  } catch (error) {
    const status = error instanceof GatewayError ? error.status : 502;
    return new Response(status === 404 ? "Not Found" : "Bad Gateway", {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}
