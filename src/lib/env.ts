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

export function getCapabilityLaunchTicketTtlSeconds() {
  return positiveInteger
    .max(60)
    .parse(process.env.CAPABILITY_LAUNCH_TICKET_TTL_SECONDS ?? "45");
}

export function getCapabilityLaunchKeyId() {
  const value = isDemoMode()
    ? process.env.CAPABILITY_LAUNCH_KEY_ID ?? "portal-capability-demo-1"
    : process.env.CAPABILITY_LAUNCH_KEY_ID;
  return z
    .string()
    .regex(/^[A-Za-z0-9._-]{3,80}$/)
    .parse(value);
}

export function getCapabilityLaunchPrivateKey() {
  if (isDemoMode()) {
    return [
      "-----BEGIN PRIVATE KEY-----",
      "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
      "-----END PRIVATE KEY-----",
      "",
    ].join("\n");
  }

  return z
    .string()
    .min(1)
    .parse(process.env.CAPABILITY_LAUNCH_PRIVATE_KEY)
    .replaceAll("\\n", "\n");
}

export function getApplicationReturnStateSecret() {
  const encoded = isDemoMode()
    ? process.env.APPLICATION_RETURN_STATE_SECRET ??
      Buffer.alloc(32, 11).toString("base64")
    : z.string().min(1).parse(process.env.APPLICATION_RETURN_STATE_SECRET);
  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error(
      "APPLICATION_RETURN_STATE_SECRET must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

export function getApplicationReturnStateTtlSeconds() {
  return positiveInteger
    .max(900)
    .parse(process.env.APPLICATION_RETURN_STATE_TTL_SECONDS ?? "600");
}

export function getApplicationGatewaySharedSecret() {
  return isDemoMode()
    ? process.env.APPLICATION_GATEWAY_SHARED_SECRET ??
        "demo-application-gateway-secret-not-for-production"
    : z.string().min(32).parse(process.env.APPLICATION_GATEWAY_SHARED_SECRET);
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

export function getHQMfaEncryptionKey() {
  const encoded = isDemoMode()
    ? Buffer.alloc(32, 7).toString("base64")
    : z.string().min(1).parse(process.env.HQ_MFA_ENCRYPTION_KEY);
  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error("HQ_MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

export function isDemoMode() {
  const enabled = process.env.PORTAL_DEMO_MODE === "true";

  if (enabled && process.env.NODE_ENV === "production") {
    throw new Error("PORTAL_DEMO_MODE must never be enabled in production.");
  }

  return enabled;
}
