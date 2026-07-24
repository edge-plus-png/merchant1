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
    email: "edge.hq@example.com",
    name: "Morgan Reed",
    status: "ACTIVE",
  },
};

const business: BusinessRecord = {
  id: "business-little-adventure",
  slug: "little-adventure-land",
  name: "Little Adventure Land",
  portalUrl: "http://little-adventure.localhost:3100",
  status: "READY",
  timezone: "Europe/London",
  currency: "GBP",
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
      operator: { id: "hq-user-edge", username: "edge.hq@example.com" },
      accessMode: "SUPPORT_READ_ONLY",
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
