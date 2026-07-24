import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();
const portalSurfaceSchema = z.enum(["HQ", "MERCHANT"]);

export type PortalSurface = z.infer<typeof portalSurfaceSchema>;

export function getSessionCookieName() {
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .parse(process.env.PORTAL_SESSION_COOKIE_NAME ?? "getedge_portal_session");
}

export function getSessionTtlHours() {
  return positiveInteger.parse(process.env.PORTAL_SESSION_TTL_HOURS ?? "12");
}

export function getHQSessionCookieName() {
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .parse(process.env.HQ_SESSION_COOKIE_NAME ?? "getedge_hq_session");
}

export function getHQSessionTtlHours() {
  return positiveInteger.parse(process.env.HQ_SESSION_TTL_HOURS ?? "8");
}

export function getHQSupportSessionCookieName() {
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .parse(
      process.env.HQ_SUPPORT_SESSION_COOKIE_NAME ??
        "getedge_hq_support_session",
    );
}

export function getHQSupportSessionTtlMinutes() {
  return positiveInteger.parse(
    process.env.HQ_SUPPORT_SESSION_TTL_MINUTES ?? "30",
  );
}

export function getHQAccessTicketTtlSeconds() {
  return positiveInteger
    .max(120)
    .parse(process.env.HQ_ACCESS_TICKET_TTL_SECONDS ?? "45");
}

export function getConfiguredPortalSurface(): PortalSurface {
  return portalSurfaceSchema.parse(process.env.PORTAL_SURFACE ?? "MERCHANT");
}

export function getHQAccessPrivateKey() {
  if (isDemoMode()) {
    return [
      "-----BEGIN PRIVATE KEY-----",
      "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
      "-----END PRIVATE KEY-----",
      "",
    ].join("\n");
  }

  return z.string().min(1).parse(process.env.HQ_ACCESS_PRIVATE_KEY);
}

export function getHQAccessPublicKey() {
  if (isDemoMode()) {
    return [
      "-----BEGIN PUBLIC KEY-----",
      "MCowBQYDK2VwAyEAX5tH9deXm2Zsh5Mnz46wHWtfT7n9GmJUoEyfsMlXKCk=",
      "-----END PUBLIC KEY-----",
      "",
    ].join("\n");
  }

  return z.string().min(1).parse(process.env.HQ_ACCESS_PUBLIC_KEY);
}

export function isDemoMode() {
  const enabled = process.env.PORTAL_DEMO_MODE === "true";

  if (enabled && process.env.NODE_ENV === "production") {
    throw new Error("PORTAL_DEMO_MODE must never be enabled in production.");
  }

  return enabled;
}
