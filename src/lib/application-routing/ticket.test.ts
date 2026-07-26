import { sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapabilityManifest } from "@/lib/application-routing/manifest";
import {
  createCapabilityLaunchTicket,
  verifyCapabilityLaunchTicketSignature,
} from "@/lib/application-routing/ticket";
import type {
  MerchantApplicationRecord,
  MerchantPortalContext,
} from "@/lib/portal-types";

const publicKey = [
  "-----BEGIN PUBLIC KEY-----",
  "MCowBQYDK2VwAyEAX5tH9deXm2Zsh5Mnz46wHWtfT7n9GmJUoEyfsMlXKCk=",
  "-----END PUBLIC KEY-----",
  "",
].join("\n");
const privateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
  "-----END PRIVATE KEY-----",
  "",
].join("\n");
const now = new Date("2026-07-26T12:00:00.000Z");
const context = {
  kind: "MERCHANT_USER",
  sessionId: "session-1",
  expiresAt: new Date("2026-07-26T18:00:00.000Z"),
  role: "OWNER",
  membershipId: "membership-1",
  user: { id: "user-1", name: "Owner", email: "owner@example.com", status: "ACTIVE" },
  business: {
    id: "business-1", slug: "merchant", name: "Merchant", legalName: null,
    supportEmail: null, contactName: null, contactPhone: null, addressLine1: null,
    addressLine2: null, city: null, county: null, postcode: null, countryCode: "GB",
    vatStatus: "NOT_REGISTERED", vatNumber: null, portalUrl: "https://merchant.example",
    status: "READY", timezone: "Europe/London", currency: "GBP", createdAt: now, updatedAt: now,
  },
} satisfies MerchantPortalContext;
const application = {
  id: "application-events", businessId: "business-1", slug: "events", name: "Events",
  summary: "Events fixture", status: "INSTALLED", launchUrl: "https://events.example",
  installedAt: now, createdAt: now, updatedAt: now,
} satisfies MerchantApplicationRecord;
const manifest = {
  schemaVersion: 1,
  slug: "events",
  name: "Events",
  contractVersion: "1.0",
  applicationOrigin: "https://events.example",
  environment: "staging",
  launchUrl: "https://events.example/api/portal-launch",
  healthUrl: "https://events.example/api/health",
  portalLaunchKeyPath: "/.well-known/getedge-portal-launch-key",
  portalRouting: {
    version: 1,
    sessionCookie: { name: "events_session" },
    assetPrefix: "/_getedge/capability-assets/events",
  },
} satisfies CapabilityManifest;

function resign(token: string, mutate: (payload: Record<string, unknown>) => void) {
  const [header, encodedPayload] = token.split(".");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  mutate(payload);
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${header}.${body}`;
  return `${input}.${sign(null, Buffer.from(input), privateKey).toString("base64url")}`;
}

describe("generic capability launch ticket", () => {
  beforeEach(() => {
    vi.stubEnv("CAPABILITY_LAUNCH_PRIVATE_KEY", privateKey);
    vi.stubEnv("CAPABILITY_LAUNCH_KEY_ID", "portal-capability-test-1");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the one generic wire profile for an arbitrary registered slug", () => {
    const launch = createCapabilityLaunchTicket(
      context, application, manifest, "https://merchant.example", now,
    );
    const header = JSON.parse(Buffer.from(launch.token.split(".")[0], "base64url").toString("utf8"));
    const payload = verifyCapabilityLaunchTicketSignature(launch.token, publicKey, now);

    expect(header.typ).toBe("GETEDGE-CAPABILITY+JWT");
    expect(payload).toMatchObject({
      audience: "events",
      applicationOrigin: "https://events.example",
      environment: "staging",
      entitlement: { slug: "events", applicationId: "application-events" },
      merchant: { id: "business-1", name: "Merchant" },
    });
    expect(payload!.expiresAt - payload!.issuedAt).toBe(45);
  });

  it("issues a fresh nonce and rejects signature tampering", () => {
    const first = createCapabilityLaunchTicket(context, application, manifest, "https://merchant.example", now);
    const second = createCapabilityLaunchTicket(context, application, manifest, "https://merchant.example", now);
    expect(first.payload.nonce).not.toBe(second.payload.nonce);
    expect(verifyCapabilityLaunchTicketSignature(`${first.token}x`, publicKey, now)).toBeNull();
  });

  it("rejects a signed audience and entitlement mismatch", () => {
    const launch = createCapabilityLaunchTicket(context, application, manifest, "https://merchant.example", now);
    const invalid = resign(launch.token, (payload) => { payload.audience = "storefront"; });
    expect(verifyCapabilityLaunchTicketSignature(invalid, publicKey, now)).toBeNull();
  });

  it("rejects expiry and a capability hosted on the Portal origin", () => {
    const launch = createCapabilityLaunchTicket(context, application, manifest, "https://merchant.example", now);
    expect(verifyCapabilityLaunchTicketSignature(launch.token, publicKey, new Date(now.getTime() + 46_000))).toBeNull();
    expect(() => createCapabilityLaunchTicket(
      context,
      { ...application, launchUrl: "https://merchant.example" },
      { ...manifest, applicationOrigin: "https://merchant.example" },
      "https://merchant.example",
      now,
    )).toThrow("separate from Merchant Portal");
  });
});
