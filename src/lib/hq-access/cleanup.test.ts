import { beforeEach, describe, expect, it } from "vitest";
import { runHQAccessCleanup } from "@/lib/hq-access/cleanup";
import {
  demoPortalStore,
  getDemoState,
  resetDemoState,
} from "@/lib/portal-store/demo-store";
import type { BusinessRecord, HQSupportSessionRecord } from "@/lib/portal-types";

const now = new Date("2026-07-25T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

const business: BusinessRecord = {
  id: "business-1",
  slug: "merchant-one",
  name: "Merchant One",
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
  portalUrl: "https://merchant-one.example",
  status: "READY",
  timezone: "Europe/London",
  currency: "GBP",
  createdAt: now,
  updatedAt: now,
};

function supportSession(id: string, expiresAt: Date): HQSupportSessionRecord {
  return {
    id,
    expiresAt,
    ticketIssuedAt: new Date(now.getTime() - day),
    auditIdentifier: `audit-${id}`,
    accessMode: "SUPPORT_READ_ONLY",
    business,
    operator: {
      hqId: "hq-edge",
      hqName: "Edge HQ",
      userId: "operator-1",
      name: "Support Operator",
      username: "support.operator",
    },
  };
}

async function seedCleanupRecords() {
  const state = await getDemoState();
  state.supportSessions.set(
    "expired-token-hash",
    supportSession("expired", new Date(now.getTime() - 1)),
  );
  state.supportSessions.set(
    "active-token-hash",
    supportSession("active", new Date(now.getTime() + day)),
  );
  state.consumedTicketNonces.set("old-nonce", {
    businessId: business.id,
    auditIdentifier: "audit-old",
    expiresAt: new Date(now.getTime() - 31 * day),
    consumedAt: new Date(now.getTime() - 31 * day),
  });
  state.consumedTicketNonces.set("recent-nonce", {
    businessId: business.id,
    auditIdentifier: "audit-recent",
    expiresAt: new Date(now.getTime() - day),
    consumedAt: new Date(now.getTime() - 29 * day),
  });
}

describe("HQ access record cleanup", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("deletes expired support sessions and keeps active sessions", async () => {
    await seedCleanupRecords();

    const result = await runHQAccessCleanup({ now, store: demoPortalStore });
    const state = await getDemoState();

    expect(result.expiredSupportSessionsDeleted).toBe(1);
    expect(state.supportSessions.has("expired-token-hash")).toBe(false);
    expect(state.supportSessions.has("active-token-hash")).toBe(true);
  });

  it("deletes old consumed nonces and keeps recent evidence", async () => {
    await seedCleanupRecords();

    const result = await runHQAccessCleanup({ now, store: demoPortalStore });
    const state = await getDemoState();

    expect(result.oldConsumedNoncesDeleted).toBe(1);
    expect(result.nonceRetentionDays).toBe(30);
    expect(state.consumedTicketNonces.has("old-nonce")).toBe(false);
    expect(state.consumedTicketNonces.has("recent-nonce")).toBe(true);
  });

  it("is safe to run repeatedly", async () => {
    await seedCleanupRecords();

    await expect(
      runHQAccessCleanup({ now, store: demoPortalStore }),
    ).resolves.toMatchObject({
      expiredSupportSessionsDeleted: 1,
      oldConsumedNoncesDeleted: 1,
    });
    await expect(
      runHQAccessCleanup({ now, store: demoPortalStore }),
    ).resolves.toMatchObject({
      expiredSupportSessionsDeleted: 0,
      oldConsumedNoncesDeleted: 0,
    });
  });
});
