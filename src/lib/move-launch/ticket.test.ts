import { sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMoveLaunchTicket,
  verifyMoveLaunchTicketSignature,
} from "@/lib/move-launch/ticket";
import type {
  MerchantApplicationRecord,
  MerchantPortalContext,
  PortalContext,
} from "@/lib/portal-types";

const demoPublicKey = [
  "-----BEGIN PUBLIC KEY-----",
  "MCowBQYDK2VwAyEAX5tH9deXm2Zsh5Mnz46wHWtfT7n9GmJUoEyfsMlXKCk=",
  "-----END PUBLIC KEY-----",
  "",
].join("\n");
const demoPrivateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
  "-----END PRIVATE KEY-----",
  "",
].join("\n");

const now = new Date("2026-07-24T12:00:00.000Z");
const context: MerchantPortalContext = {
  kind: "MERCHANT_USER",
  sessionId: "portal_session_1",
  expiresAt: new Date("2026-07-24T18:00:00.000Z"),
  role: "ADMIN",
  membershipId: "membership_1",
  user: {
    id: "user_1",
    name: "Alex Admin",
    email: "alex@example.com",
    status: "ACTIVE",
  },
  business: {
    id: "business_1",
    slug: "summit-retail",
    name: "Summit Retail",
    legalName: null,
    supportEmail: null,
    contactName: null,
    contactPhone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    county: null,
    postcode: null,
    countryCode: "GB",
    vatStatus: "NOT_REGISTERED",
    vatNumber: null,
    portalUrl: "https://summit.getedgeportal.app",
    status: "READY",
    timezone: "Europe/London",
    currency: "GBP",
    createdAt: now,
    updatedAt: now,
  },
};
const application: MerchantApplicationRecord = {
  id: "application_move_1",
  businessId: context.business.id,
  slug: "move",
  name: "Move",
  summary: "Manage your Move access for this business.",
  status: "INSTALLED",
  launchUrl: "https://move.example.test",
  installedAt: now,
  createdAt: now,
  updatedAt: now,
};

function resignTicket(
  token: string,
  mutatePayload: (payload: Record<string, unknown>) => void,
) {
  const [header, payloadValue] = token.split(".");
  const payload = JSON.parse(
    Buffer.from(payloadValue, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  mutatePayload(payload);
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${body}`;
  const signature = sign(
    null,
    Buffer.from(signingInput),
    demoPrivateKey,
  ).toString("base64url");
  return `${signingInput}.${signature}`;
}

describe("Move launch ticket", () => {
  beforeEach(() => {
    vi.stubEnv("MOVE_LAUNCH_PRIVATE_KEY", demoPrivateKey);
    vi.stubEnv("MOVE_LAUNCH_KEY_ID", "portal-move-test-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs a short-lived merchant handover for the external Move origin", () => {
    const launch = createMoveLaunchTicket(
      context,
      application,
      "https://summit.getedgeportal.app",
      now,
    );
    const payload = verifyMoveLaunchTicketSignature(
      launch.token,
      demoPublicKey,
      now,
    );

    expect(payload).toMatchObject({
      audience: "move",
      environment: "staging",
      initiatedBy: "merchant-user:user_1",
      portalOrigin: "https://summit.getedgeportal.app",
      moveOrigin: "https://move.example.test",
      merchant: { id: "business_1", name: "Summit Retail" },
      entitlement: { applicationId: "application_move_1", slug: "move" },
    });
    expect(payload!.expiresAt - payload!.issuedAt).toBe(45);
  });

  it("launches from Edge full access without sending an HQ operator identity", () => {
    const edgeContext: PortalContext = {
      kind: "EDGE",
      sessionId: "edge-session-1",
      expiresAt: context.expiresAt,
      role: "EDGE",
      membershipId: null,
      user: {
        id: "hq-user-1",
        username: "edge.operator",
        name: "Edge Operator",
        status: "ACTIVE",
      },
      business: context.business,
      support: {
        hqId: "edge-hq",
        hqName: "Edge HQ",
        accessMode: "EDGE_FULL_ACCESS",
        ticketIssuedAt: now,
        auditIdentifier: "hqa-edge-1",
      },
    };
    const launch = createMoveLaunchTicket(
      edgeContext,
      application,
      "https://summit.getedgeportal.app",
      now,
    );
    const payload = verifyMoveLaunchTicketSignature(
      launch.token,
      demoPublicKey,
      now,
    );

    expect(payload).toMatchObject({ initiatedBy: "edge-full-access" });
    expect(JSON.stringify(payload)).not.toContain("edge.operator");
    expect(JSON.stringify(payload)).not.toContain("hq-user-1");
    expect(JSON.stringify(payload)).not.toContain("hqa-edge-1");
  });

  it("issues a unique nonce for every launch and rejects tampering", () => {
    const first = createMoveLaunchTicket(
      context,
      application,
      "https://summit.getedgeportal.app",
      now,
    );
    const second = createMoveLaunchTicket(
      context,
      application,
      "https://summit.getedgeportal.app",
      now,
    );

    expect(first.payload.nonce).not.toBe(second.payload.nonce);
    expect(
      verifyMoveLaunchTicketSignature(`${first.token}tampered`, demoPublicKey, now),
    ).toBeNull();
  });

  it("supports the merchant-owned Move zone and rejects expired tickets", () => {
    const merchantZoneLaunch = createMoveLaunchTicket(
      context,
      { ...application, launchUrl: "https://summit.getedgeportal.app" },
      "https://summit.getedgeportal.app",
      now,
    );
    expect(
      verifyMoveLaunchTicketSignature(
        merchantZoneLaunch.token,
        demoPublicKey,
        now,
      ),
    ).toMatchObject({
      portalOrigin: "https://summit.getedgeportal.app",
      moveOrigin: "https://summit.getedgeportal.app",
    });

    const launch = createMoveLaunchTicket(
      context,
      application,
      "https://summit.getedgeportal.app",
      now,
    );
    expect(
      verifyMoveLaunchTicketSignature(
        launch.token,
        demoPublicKey,
        new Date(now.getTime() + 46_000),
      ),
    ).toBeNull();
  });

  it("rejects a correctly signed ticket for another audience", () => {
    const launch = createMoveLaunchTicket(
      context,
      application,
      "https://summit.getedgeportal.app",
      now,
    );
    const wrongAudience = resignTicket(launch.token, (payload) => {
      payload.audience = "another-capability";
    });

    expect(
      verifyMoveLaunchTicketSignature(wrongAudience, demoPublicKey, now),
    ).toBeNull();
  });
});
