import { describe, expect, it } from "vitest";
import {
  hashSessionToken,
  resolveHQSupportContext,
  resolvePortalContext,
} from "@/lib/auth/session";
import type { PortalStore } from "@/lib/portal-store/types";
import type { MembershipRecord } from "@/lib/portal-types";

const membership: MembershipRecord = {
  id: "membership_1",
  role: "OWNER",
  isActive: true,
  business: {
    id: "business_1",
    slug: "correct-business",
    name: "Correct Business",
    legalName: "Correct Business Ltd",
    supportEmail: "support@example.com",
    contactName: "Business Owner",
    contactPhone: "+44 20 7946 0000",
    addressLine1: "1 High Street",
    addressLine2: null,
    city: "London",
    county: null,
    postcode: "SW1A 1AA",
    countryCode: "GB",
    vatStatus: "NOT_REGISTERED",
    vatNumber: null,
    portalUrl: "https://correct-business.example",
    status: "READY",
    timezone: "Europe/London",
    currency: "GBP",
    createdAt: new Date("2026-07-23T00:00:00.000Z"),
    updatedAt: new Date("2026-07-24T00:00:00.000Z"),
  },
  user: {
    id: "user_1",
    email: "owner@example.com",
    name: "Owner",
    passwordHash: "not-returned",
    status: "ACTIVE",
  },
};

function createStore(expiresAt: Date): PortalStore {
  return {
    findLoginMembership: async () => membership,
    createSession: async () => undefined,
    deleteSession: async () => undefined,
    findSession: async (tokenHash) =>
      tokenHash === hashSessionToken("valid-token")
        ? { id: "session_1", expiresAt, membership }
        : null,
    findLocalBusiness: async () => membership.business,
    consumeTicketAndCreateSupportSession: async () => "created",
    findSupportSession: async () => null,
    deleteSupportSession: async () => undefined,
    cleanupHQAccessRecords: async () => ({
      expiredSupportSessionsDeleted: 0,
      oldConsumedNoncesDeleted: 0,
    }),
    listHQAccessAuditEvents: async () => [],
    updateBusiness: async () => membership.business,
    listMemberships: async () => [],
    listPendingInvitations: async () => [],
    createInvitation: async () => "already_member",
    findInvitation: async () => null,
    acceptInvitation: async () => "invalid",
    revokeInvitation: async () => false,
    updateMembershipRole: async () => "not_found",
    setMembershipActive: async () => "not_found",
    listApplications: async () => [],
    installMove: async () => ({ status: "not_found" }),
  };
}

describe("Portal business context", () => {
  it("resolves the business through the authenticated membership", async () => {
    const context = await resolvePortalContext(
      "valid-token",
      createStore(new Date(Date.now() + 60_000)),
    );

    expect(context?.business).toMatchObject({
      id: "business_1",
      slug: "correct-business",
      name: "Correct Business",
    });
    expect(context?.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an expired session", async () => {
    const context = await resolvePortalContext(
      "valid-token",
      createStore(new Date(Date.now() - 1)),
    );
    expect(context).toBeNull();
  });

  it("resolves full Edge authority without creating a merchant membership", async () => {
    const store = createStore(new Date(Date.now() + 60_000));
    store.findSupportSession = async (tokenHash) =>
      tokenHash === hashSessionToken("edge-token")
        ? {
            id: "edge-session",
            expiresAt: new Date(Date.now() + 60_000),
            ticketIssuedAt: new Date(),
            auditIdentifier: "hqa_edge_access",
            accessMode: "EDGE_FULL_ACCESS",
            business: membership.business,
            operator: {
              hqId: "edge-hq",
              hqName: "Edge HQ",
              userId: "edge-user",
              name: "Edge Operator",
              username: "edge.operator",
            },
          }
        : null;

    const context = await resolveHQSupportContext("edge-token", store);

    expect(context).toMatchObject({
      kind: "EDGE",
      role: "EDGE",
      membershipId: null,
      support: { accessMode: "EDGE_FULL_ACCESS" },
    });
  });
});
