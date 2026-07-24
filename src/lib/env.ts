import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();

export function getSessionCookieName() {
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .parse(process.env.PORTAL_SESSION_COOKIE_NAME ?? "getedge_portal_session");
}

export function getSessionTtlHours() {
  return positiveInteger.parse(process.env.PORTAL_SESSION_TTL_HOURS ?? "12");
}

export function isDemoMode() {
  const enabled = process.env.PORTAL_DEMO_MODE === "true";

  if (enabled && process.env.NODE_ENV === "production") {
    throw new Error("PORTAL_DEMO_MODE must never be enabled in production.");
  }

  return enabled;
}
