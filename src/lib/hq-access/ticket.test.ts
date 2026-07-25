import { describe, expect, it } from "vitest";
import {
  createHQAccessTicket,
  verifyHQAccessTicket,
} from "@/lib/hq-access/ticket";
import type { BusinessRecord, HQContext } from "@/lib/portal-types";

process.env.PORTAL_DEMO_MODE = "true";

const context: HQContext = {
  sessionId: "hq-session",
  expiresAt: new Date("2026-07-24T00:00:00.000Z"),
  membershipId: "membership-edge",
  role: "OPERATOR",
  hq: {
    id: "hq-edge",
    slug: "edge",
    name: "Edge HQ",
    type: "EDGE",
  },
  user: {
    id: "hq-user-edge",
    username: "edge.master",
    name: "Morgan Reed",
    mfaEnabledAt: new Date("2026-07-23T19:00:00.000Z"),
    status: "ACTIVE",
  },
};

const business: BusinessRecord = {
  id: "business-little-adventure",
  slug: "little-adventure-land",
  name: "Little Adventure Land",
  legalName: "Little Adventure Land Ltd",
  supportEmail: "support@example.com",
  contactName: "Morgan Reed",
  contactPhone: "+44 20 7946 0000",
  addressLine1: "1 High Street",
  addressLine2: null,
  city: "London",
  county: null,
  postcode: "SW1A 1AA",
  countryCode: "GB",
  vatStatus: "NOT_REGISTERED",
  vatNumber: null,
  portalUrl: "http://little-adventure.localhost:3100",
  status: "READY",
  timezone: "Europe/London",
  currency: "GBP",
  createdAt: new Date("2026-07-23T00:00:00.000Z"),
  updatedAt: new Date("2026-07-24T00:00:00.000Z"),
};

describe("HQ merchant-access tickets", () => {
  it("verifies a signed ticket only for its target business and origin", () => {
    const now = new Date("2026-07-23T20:00:00.000Z");
    const ticket = createHQAccessTicket(context, business, now);

    expect(
      verifyHQAccessTicket(
        ticket.token,
        {
          businessId: business.id,
          portalOrigin: business.portalUrl!,
        },
        new Date(now.getTime() + 10_000),
      ),
    ).toMatchObject({
      targetBusiness: { id: business.id },
      originHq: { id: "hq-edge" },
      operator: { id: "hq-user-edge", username: "edge.master" },
      accessMode: "EDGE_FULL_ACCESS",
    });
    expect(
      verifyHQAccessTicket(
        ticket.token,
        {
          businessId: "another-business",
          portalOrigin: business.portalUrl!,
        },
        new Date(now.getTime() + 10_000),
      ),
    ).toBeNull();
  });

  it("keeps affiliate access read-only", () => {
    const ticket = createHQAccessTicket(
      { ...context, hq: { ...context.hq, type: "AFFILIATE" } },
      business,
      new Date("2026-07-23T20:00:00.000Z"),
    );

    expect(ticket.payload.accessMode).toBe("SUPPORT_READ_ONLY");
  });

  it("rejects tampering and expiry", () => {
    const now = new Date("2026-07-23T20:00:00.000Z");
    const ticket = createHQAccessTicket(context, business, now);
    const [header, body, signature] = ticket.token.split(".");
    const tamperedBody = `${body.slice(0, 12)}${body[12] === "a" ? "b" : "a"}${body.slice(13)}`;

    expect(
      verifyHQAccessTicket(
        `${header}.${tamperedBody}.${signature}`,
        { businessId: business.id, portalOrigin: business.portalUrl! },
        new Date(now.getTime() + 1_000),
      ),
    ).toBeNull();
    expect(
      verifyHQAccessTicket(
        ticket.token,
        { businessId: business.id, portalOrigin: business.portalUrl! },
        new Date(now.getTime() + 46_000),
      ),
    ).toBeNull();
  });
});
