import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();
const portalSurfaceSchema = z.enum(["HQ", "MERCHANT"]);

export type PortalSurface = z.infer<typeof portalSurfaceSchema>;

export const moveApplicationOrigins = {
  staging: "https://move-staging.getedgeportal.app",
  production: "https://move.getedgeportal.app",
} as const;

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

export function getMoveLaunchTicketTtlSeconds() {
  return positiveInteger
    .max(60)
    .parse(process.env.MOVE_LAUNCH_TICKET_TTL_SECONDS ?? "45");
}

export function getMoveLaunchKeyId() {
  const value = isDemoMode()
    ? process.env.MOVE_LAUNCH_KEY_ID ?? "portal-move-demo-1"
    : process.env.MOVE_LAUNCH_KEY_ID;
  return z
    .string()
    .regex(/^[A-Za-z0-9._-]{3,80}$/)
    .parse(value);
}

export function getMoveLaunchPrivateKey() {
  if (isDemoMode()) {
    return [
      "-----BEGIN PRIVATE KEY-----",
      "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
      "-----END PRIVATE KEY-----",
      "",
    ].join("\n");
  }

  return z.string().min(1).parse(process.env.MOVE_LAUNCH_PRIVATE_KEY);
}

export function getMoveApplicationOrigin() {
  const configured = process.env.MOVE_APPLICATION_ORIGIN ??
    (isDemoMode() ? "https://move.example.test" : undefined);

  const origin = parseMoveApplicationOrigin(z.string().url().parse(configured));

  if (
    process.env.NODE_ENV === "production" &&
    !Object.values(moveApplicationOrigins).includes(
      origin as (typeof moveApplicationOrigins)[keyof typeof moveApplicationOrigins],
    )
  ) {
    throw new Error("MOVE_APPLICATION_ORIGIN is not a trusted Move origin.");
  }

  return origin;
}

export function getMoveApplicationEnvironment(origin: string) {
  const normalized = parseMoveApplicationOrigin(origin);
  if (normalized === moveApplicationOrigins.staging) return "staging" as const;
  if (normalized === moveApplicationOrigins.production) return "production" as const;
  if (process.env.NODE_ENV !== "production") return "staging" as const;
  throw new Error("Move environment cannot be determined from its origin.");
}

export function parseMoveApplicationOrigin(value: string) {
  const url = new URL(value);
  const permitsLocalHttp =
    process.env.NODE_ENV !== "production" &&
    (url.hostname === "localhost" || url.hostname.endsWith(".localhost"));

  if (
    (url.protocol !== "https:" && !permitsLocalHttp) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("MOVE_APPLICATION_ORIGIN must be a trusted HTTPS origin without a path, query, or credentials.");
  }

  return url.origin;
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
