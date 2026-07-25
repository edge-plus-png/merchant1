import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getConfiguredPortalSurface,
  isDemoMode,
  type PortalSurface,
} from "@/lib/env";

function surfaceFromHost(host: string): PortalSurface {
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "hq.localhost" ? "HQ" : "MERCHANT";
}

export function resolvePortalSurface(host?: string | null): PortalSurface {
  if (isDemoMode()) {
    return surfaceFromHost(host ?? "");
  }

  return getConfiguredPortalSurface();
}

export function requestSurface(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? new URL(request.url).host;
  return resolvePortalSurface(host);
}

export function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");

  if (host) {
    return `${forwardedProtocol ?? new URL(request.url).protocol.replace(":", "")}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function getPortalSurface() {
  const requestHeaders = await headers();
  return resolvePortalSurface(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );
}

export function requireRequestSurface(
  request: Request,
  expected: PortalSurface,
) {
  return requestSurface(request) === expected;
}

export async function requirePageSurface(expected: PortalSurface) {
  if ((await getPortalSurface()) !== expected) {
    notFound();
  }
}
