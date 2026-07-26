import { describe, expect, it, vi } from "vitest";
import {
  classifyRoute,
  handleGatewayRequest,
  scopeCapabilityCookie,
} from "./gateway.mjs";

const config = {
  portalUpstreamOrigin: "https://merchant1.vercel.app",
  portalPublicOrigin: "https://merchant.getedgeportal.app",
  portalCookieNames: ["getedge_portal_session", "getedge_hq_support_session"],
  sharedSecret: "test-shared-secret-with-at-least-32-characters",
};

function record(slug) {
  return {
    available: true,
    slug,
    applicationOrigin: `https://${slug}.example`,
    environment: "staging",
    launchUrl: `https://${slug}.example/api/portal-launch`,
    portalRouting: {
      version: 1,
      sessionCookie: { name: `${slug}_session` },
      assetPrefix: `/_getedge/capability-assets/${slug}`,
    },
  };
}

const capabilityCsp =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

describe("stateless application gateway contract", () => {
  it("uses one generic matcher for current and future capability slugs", () => {
    expect(classifyRoute("/apps/move/ops")).toMatchObject({
      kind: "capability-page",
      slug: "move",
      upstreamPath: "/ops",
    });
    expect(classifyRoute("/apps/future-fixture/dashboard")).toMatchObject({
      kind: "capability-page",
      slug: "future-fixture",
      upstreamPath: "/dashboard",
    });
    expect(classifyRoute("/apps/future-fixture")).toEqual({ kind: "portal" });
  });

  it("forwards only the manifest-declared capability cookie", async () => {
    const upstreamRequests = [];
    const fetcher = vi.fn(async (input, init = {}) => {
      const url = new URL(input);
      if (url.hostname === "merchant1.vercel.app") {
        return Response.json(record("alpha"));
      }
      upstreamRequests.push({ url: url.toString(), headers: new Headers(init.headers) });
      return new Response("alpha page", {
        headers: {
          "Content-Security-Policy": capabilityCsp,
          "Set-Cookie": "alpha_session=CAPABILITY_TOKEN; Path=/; HttpOnly; Secure; SameSite=Lax",
        },
      });
    });
    const response = await handleGatewayRequest(
      new Request("https://merchant.getedgeportal.app/apps/alpha/ops", {
        headers: {
          Cookie:
            "getedge_portal_session=PORTAL_TOKEN; alpha_session=CAPABILITY_TOKEN; bravo_session=BRAVO_TOKEN",
        },
      }),
      config,
      fetcher,
    );

    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0].url).toBe("https://alpha.example/ops");
    expect(upstreamRequests[0].headers.get("cookie")).toBe(
      "alpha_session=CAPABILITY_TOKEN",
    );
    expect(upstreamRequests[0].headers.get("x-forwarded-host")).toBe(
      "alpha.example",
    );
    expect(upstreamRequests[0].headers.get("x-getedge-browser-origin")).toBe(
      "https://merchant.getedgeportal.app",
    );
    expect(response.headers.get("set-cookie")).toBe(
      "alpha_session=CAPABILITY_TOKEN; Path=/apps/alpha/; HttpOnly; Secure; SameSite=Lax",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "https://merchant.getedgeportal.app/_getedge/capability-assets/alpha/",
    );
    expect(response.headers.get("content-security-policy")).not.toContain(
      "script-src 'self'",
    );
  });

  it("forwards only Portal-owned cookies to the Portal server", async () => {
    let forwardedCookie = null;
    const fetcher = vi.fn(async (_input, init = {}) => {
      forwardedCookie = new Headers(init.headers).get("cookie");
      return new Response("portal");
    });
    await handleGatewayRequest(
      new Request("https://merchant.getedgeportal.app/apps", {
        headers: {
          Cookie:
            "getedge_portal_session=PORTAL_TOKEN; alpha_session=CAPABILITY_TOKEN",
        },
      }),
      config,
      fetcher,
    );

    expect(forwardedCookie).toBe("getedge_portal_session=PORTAL_TOKEN");
  });

  it("keeps Portal redirects public and drops non-Portal response cookies", async () => {
    const fetcher = vi.fn(async () => {
      const headers = new Headers({
        Location: "https://merchant1.vercel.app/business",
      });
      headers.append(
        "Set-Cookie",
        "getedge_portal_session=PORTAL_TOKEN; Path=/; HttpOnly; Secure",
      );
      headers.append(
        "Set-Cookie",
        "alpha_session=CAPABILITY_TOKEN; Path=/apps/alpha/; HttpOnly; Secure",
      );
      return new Response(null, { status: 303, headers });
    });

    const response = await handleGatewayRequest(
      new Request("https://merchant.getedgeportal.app/api/auth/login", {
        method: "POST",
      }),
      config,
      fetcher,
    );

    expect(response.headers.get("location")).toBe(
      "https://merchant.getedgeportal.app/business",
    );
    expect(response.headers.getSetCookie()).toEqual([
      "getedge_portal_session=PORTAL_TOKEN; Path=/; HttpOnly; Secure",
    ]);
  });

  it("routes two capability asset namespaces without cross-contamination", async () => {
    const requested = [];
    const fetcher = vi.fn(async (input) => {
      const url = new URL(input);
      if (url.hostname === "merchant1.vercel.app") {
        const slug = url.pathname.split("/").at(-1);
        return Response.json(record(slug));
      }
      requested.push(url.toString());
      return new Response(`${url.hostname}-chunk`, {
        headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      });
    });

    const alpha = await handleGatewayRequest(
      new Request(
        "https://merchant.getedgeportal.app/_getedge/capability-assets/alpha/_next/static/chunk.js",
      ),
      config,
      fetcher,
    );
    const bravo = await handleGatewayRequest(
      new Request(
        "https://merchant.getedgeportal.app/_getedge/capability-assets/bravo/_next/static/chunk.js",
      ),
      config,
      fetcher,
    );

    expect(requested).toEqual([
      "https://alpha.example/_getedge/capability-assets/alpha/_next/static/chunk.js",
      "https://bravo.example/_getedge/capability-assets/bravo/_next/static/chunk.js",
    ]);
    expect(await alpha.text()).toBe("alpha.example-chunk");
    expect(await bravo.text()).toBe("bravo.example-chunk");
  });

  it("adds a fixture capability through its registry record without route code", async () => {
    const fetcher = vi.fn(async (input) => {
      const url = new URL(input);
      if (url.hostname === "merchant1.vercel.app") {
        return Response.json(record("future-fixture"));
      }
      return new Response("future fixture", {
        headers: { "Content-Security-Policy": capabilityCsp },
      });
    });
    const response = await handleGatewayRequest(
      new Request(
        "https://merchant.getedgeportal.app/apps/future-fixture/dashboard",
      ),
      config,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("future fixture");
  });

  it("issues a capability-scoped CSP when the upstream has none", async () => {
    const fetcher = vi.fn(async (input) => {
      const url = new URL(input);
      if (url.hostname === "merchant1.vercel.app") {
        return Response.json(record("alpha"));
      }
      return new Response("alpha page");
    });

    const response = await handleGatewayRequest(
      new Request("https://merchant.getedgeportal.app/apps/alpha/ops"),
      config,
      fetcher,
    );
    const csp = response.headers.get("content-security-policy");

    expect(response.status).toBe(200);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain(
      "form-action https://merchant.getedgeportal.app/apps/alpha/",
    );
    expect(csp).toContain(
      "script-src https://merchant.getedgeportal.app/_getedge/capability-assets/alpha/ 'unsafe-inline'",
    );
    expect(csp).not.toContain("script-src 'self'");
  });

  it("never writes cookie or token values to runtime or error logs", async () => {
    const knownToken = "KNOWN_GATEWAY_TEST_TOKEN_740128";
    const captured = [];
    const spies = ["log", "info", "warn", "error", "debug"].map((method) =>
      vi.spyOn(console, method).mockImplementation((...values) => {
        captured.push(values.join(" "));
      }),
    );
    const fetcher = vi.fn(async () => {
      throw new Error(`upstream failed while handling ${knownToken}`);
    });

    const response = await handleGatewayRequest(
      new Request("https://merchant.getedgeportal.app/apps", {
        headers: { Cookie: `getedge_portal_session=${knownToken}` },
      }),
      config,
      fetcher,
    );
    for (const spy of spies) spy.mockRestore();

    expect(response.status).toBe(502);
    expect(await response.text()).toBe("Bad Gateway");
    expect(captured.join("\n")).not.toContain(knownToken);
  });

  it("rejects undeclared capability cookies and forces the declared scope", () => {
    const routing = { slug: "alpha", sessionCookieName: "alpha_session" };
    expect(scopeCapabilityCookie("other=value; Path=/", routing)).toBeNull();
    expect(
      scopeCapabilityCookie(
        "alpha_session=value; Domain=merchant.getedgeportal.app; Path=/; SameSite=None",
        routing,
      ),
    ).toBe(
      "alpha_session=value; Path=/apps/alpha/; HttpOnly; Secure; SameSite=Lax",
    );
  });
});
