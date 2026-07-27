import { beforeEach, describe, expect, it } from "vitest";
import { demoHQStore } from "@/lib/hq-store/demo-store";
import {
  demoPortalStore,
  getDemoState,
  resetDemoState,
} from "@/lib/portal-store/demo-store";
import type { PortalRole } from "@/lib/portal-types";

async function createMerchantWithOwner() {
  const business = await demoHQStore.createMerchant({
    name: "Summit Retail",
    slug: "summit-retail",
    portalUrl: "http://summit-retail.localhost:3100",
    status: "READY",
  });
  const owner = {
    id: "membership_owner",
    role: "OWNER" as const,
    isActive: true,
    business,
    user: {
      id: "user_owner",
      name: "Jane Owner",
      email: "jane@example.com",
      passwordHash: "test-hash",
      status: "ACTIVE" as const,
    },
  };
  (await getDemoState()).memberships.push(owner);
  return { business, owner };
}

describe("merchant milestone store", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("persists business information on the merchant record", async () => {
    const { business } = await createMerchantWithOwner();
    const updated = await demoPortalStore.updateBusiness({
      businessId: business.id,
      name: "Summit Retail",
      legalName: "Summit Retail Ltd",
      supportEmail: "support@summit.example",
      contactName: "Jane Owner",
      contactPhone: "+44 20 7946 0958",
      addressLine1: "1 Victoria Street",
      addressLine2: null,
      city: "Manchester",
      county: "Greater Manchester",
      postcode: "M3 1AE",
      countryCode: "GB",
      vatStatus: "REGISTERED",
      vatNumber: "GB123456789",
      timezone: "Europe/London",
      currency: "GBP",
    });

    expect(updated).toMatchObject({
      legalName: "Summit Retail Ltd",
      supportEmail: "support@summit.example",
      vatStatus: "REGISTERED",
      vatNumber: "GB123456789",
    });
  });

  it("creates a single-use invitation and accepts it into membership", async () => {
    const { business, owner } = await createMerchantWithOwner();
    const invitation = await demoPortalStore.createInvitation({
      businessId: business.id,
      invitedByMembershipId: owner.id,
      name: "Alex Admin",
      email: "alex@example.com",
      username: "alex",
      usernameNormalized: "alex",
      role: "ADMIN",
      tokenHash: "invite-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(invitation).toMatchObject({
      email: "alex@example.com",
      role: "ADMIN",
    });
    await expect(
      demoPortalStore.acceptInvitation({
        tokenHash: "invite-hash",
        passwordHash: "password-hash",
      }),
    ).resolves.toBe("accepted");
    await expect(
      demoPortalStore.acceptInvitation({
        tokenHash: "invite-hash",
        passwordHash: "password-hash",
      }),
    ).resolves.toBe("invalid");

    const users = await demoPortalStore.listMemberships(business.id);
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      email: "jane@example.com",
      role: "OWNER",
      isPrimaryOwner: true,
    });
    expect(users[1]).toMatchObject({
      email: "alex@example.com",
      role: "ADMIN",
    });
  });

  it("allows Edge setup without membership attribution or merchant audit", async () => {
    const { business, owner } = await createMerchantWithOwner();
    const state = await getDemoState();
    const now = new Date();

    await expect(
      demoPortalStore.consumeTicketAndCreateSupportSession({
        tokenHash: "edge-session-hash",
        nonce: "edge-ticket-nonce",
        businessId: business.id,
        originHqId: "edge-hq",
        originHqName: "Edge HQ",
        hqUserId: "edge-user",
        operatorName: "Edge Operator",
        operatorUsername: "edge.operator",
        accessMode: "EDGE_FULL_ACCESS",
        ticketIssuedAt: now,
        ticketExpiresAt: new Date(now.getTime() + 60_000),
        sessionExpiresAt: new Date(now.getTime() + 30 * 60_000),
        auditIdentifier: "hqa_edge_access",
      }),
    ).resolves.toBe("created");
    expect(state.supportSessions.size).toBe(1);
    expect(state.consumedTicketNonces.size).toBe(1);
    expect(state.hqAccessAudits).toHaveLength(0);

    await expect(
      demoPortalStore.createInvitation({
        businessId: business.id,
        invitedByMembershipId: null,
        name: "New Owner",
        email: "new-owner@example.com",
        username: "new-owner",
        usernameNormalized: "new-owner",
        role: "OWNER",
        tokenHash: "edge-owner-invite",
        expiresAt: new Date(now.getTime() + 60_000),
      }),
    ).resolves.toMatchObject({ role: "OWNER" });

    await expect(
      demoPortalStore.updateMembershipRole({
        businessId: business.id,
        actorMembershipId: null,
        actorRole: "EDGE",
        membershipId: owner.id,
        role: "OWNER",
      }),
    ).resolves.toBe("updated");
  });

  it.each(["ADMIN", "MANAGER", "USER", "LITE"] as PortalRole[])(
    "supports the %s merchant role",
    async (role) => {
      const { business, owner } = await createMerchantWithOwner();
      const state = await getDemoState();
      state.memberships.push({
        id: `membership_${role.toLowerCase()}`,
        role,
        isActive: true,
        business,
        user: {
          id: `user_${role.toLowerCase()}`,
          name: role,
          email: `${role.toLowerCase()}@example.com`,
          passwordHash: "test-hash",
          status: "ACTIVE",
        },
      });

      await expect(
        demoPortalStore.updateMembershipRole({
          businessId: business.id,
          actorMembershipId: owner.id,
          actorRole: owner.role,
          membershipId: `membership_${role.toLowerCase()}`,
          role,
        }),
      ).resolves.toBe("updated");
    },
  );

  it("protects the primary Owner and renders the real Move state", async () => {
    const { business, owner } = await createMerchantWithOwner();

    await expect(
      demoPortalStore.updateMembershipRole({
        businessId: business.id,
        actorMembershipId: owner.id,
        actorRole: owner.role,
        membershipId: owner.id,
        role: "ADMIN",
      }),
    ).resolves.toBe("primary_owner");
    await expect(
      demoPortalStore.setMembershipActive({
        businessId: business.id,
        actorMembershipId: owner.id,
        membershipId: owner.id,
        isActive: false,
      }),
    ).resolves.toBe("self");

    await expect(
      demoPortalStore.listApplications(business.id),
    ).resolves.toMatchObject([
      {
        slug: "move",
        name: "Move",
        status: "NOT_INSTALLED",
        launchUrl: null,
      },
    ]);
  });

  it("installs only the Move entitlement against its trusted external origin", async () => {
    const { business } = await createMerchantWithOwner();

    const installed = await demoPortalStore.installApplication(
      business.id,
      "move",
      "https://move.example.test",
    );
    expect(installed).toMatchObject({
      status: "installed",
      application: {
        status: "INSTALLED",
        launchUrl: "https://move.example.test",
      },
    });
    expect(
      installed.status === "not_found"
        ? null
        : installed.application.installedAt,
    ).toBeInstanceOf(Date);

    await expect(
      demoPortalStore.installApplication(
        business.id,
        "move",
        "https://move.example.test",
      ),
    ).resolves.toMatchObject({
      status: "already_installed",
    });
    expect(Object.keys(await getDemoState())).not.toContain("moveSessions");
    expect(Object.keys(await getDemoState())).not.toContain("moveConfigurations");
  });

  it("keeps application access scoped by membership and application slug", async () => {
    const { business, owner } = await createMerchantWithOwner();
    const state = await getDemoState();
    state.capabilityAccess.push({
      businessId: business.id,
      membershipId: owner.id,
      capabilitySlug: "move",
    });

    await expect(
      demoPortalStore.listApplicationAccessSlugs(business.id, owner.id),
    ).resolves.toEqual(["move"]);
    await expect(
      demoPortalStore.listApplicationAccessSlugs(business.id, "another-user"),
    ).resolves.toEqual([]);
  });
});
