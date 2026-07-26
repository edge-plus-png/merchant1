import { NextRequest, NextResponse } from "next/server";
import {
  getMoveApplicationUpstreamOrigin,
  getMoveProxySecret,
  moveApplicationBasePath,
} from "@/lib/env";

const moveSessionCookieName = "counter_ops_session";
const movePublicOriginHeader = "x-getedge-move-public-origin";
const moveProxySecretHeader = "x-getedge-move-proxy-secret";

function moveCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${moveSessionCookieName}=`));

  return cookies.length ? cookies.join("; ") : null;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === moveApplicationBasePath) {
    return NextResponse.next();
  }

  const upstreamUrl = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    getMoveApplicationUpstreamOrigin(),
  );
  const requestHeaders = new Headers(request.headers);
  const capabilityCookies = moveCookieHeader(request.headers.get("cookie"));

  if (capabilityCookies) {
    requestHeaders.set("cookie", capabilityCookies);
  } else {
    requestHeaders.delete("cookie");
  }
  requestHeaders.delete(movePublicOriginHeader);
  requestHeaders.delete(moveProxySecretHeader);
  requestHeaders.set(movePublicOriginHeader, request.nextUrl.origin);
  requestHeaders.set(moveProxySecretHeader, getMoveProxySecret());

  return NextResponse.rewrite(upstreamUrl, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: "/apps/move/:path*",
};
