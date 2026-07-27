import { beforeEach, describe, expect, it } from "vitest";
import { demoHQStore } from "@/lib/hq-store/demo-store";
import {
  demoPortalStore,
  getDemoState,
  resetDemoState,
} from "@/lib/portal-store/demo-store";
import type { BusinessRecord, MembershipRecord, PortalRole } from "@/lib/portal-types";

async function createBusiness(slug: string) {
  return demoHQStore.createMerchant({
    name: slug,
    slug,
    portalUrl: `http://${slug}.localhost:3100`,
    status: "READY",
  });
}

async function addMember(
  business: BusinessRecord,
  role: PortalRole,
  id: string,
  email = `${id}@example.com`,
) {
  const membership: MembershipRecord = {
    id,
    role,
    isActive: true,
    username: null,
    usernameNormalized: null,
    business,
    user: {
      id: `user_${id}`,
      name: id,
      email,
      passwordHash: `password_${id}`,
      status: "ACTIVE",
    },
  };
  (await getDemoState()).memberships.push(membership);
  return membership;
}

async function requestReset(
  business: BusinessRecord,
  actor: MembershipRecord | null,
  actorRole: PortalRole | "EDGE",
  target: MembershipRecord,
  token: string,
) {
  return demoPortalStore.createPasswordReset({
    businessId: business.id,
    actorMembershipId: actor?.id ?? null,
    actorKey: actor ? `membership:${actor.id}` : "edge:operator",
    actorRole,
    targetMembershipId: target.id,
    tokenHash: token,
    expiresAt: new Date(Date.now() + 15 * 60_000),
    rateWindowStartedAt: new Date(Date.now() - 15 * 60_000),
  });
}

describe("Portal auth changes outcome contract", () => {
  beforeEach(() => resetDemoState());

  it("1. OWNER creates an audited same-business reset and is rate-limited per actor and target", async () => {
    const business = await createBusiness("reset-owner");
    const owner = await addMember(business, "OWNER", "owner");
    const user = await addMember(business, "USER", "user");

    await expect(requestReset(business, owner, "OWNER", user, "reset-1"))
      .resolves.toMatchObject({ status: "created" });
    await expect(demoPortalStore.listUserSecurityAudits(business.id)).resolves.toMatchObject([
      {
        actorMembershipId: owner.id,
        targetMembershipId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
      },
    ]);
    await requestReset(business, owner, "OWNER", user, "reset-2");
    await requestReset(business, owner, "OWNER", user, "reset-3");
    await expect(requestReset(business, owner, "OWNER", user, "reset-4"))
      .resolves.toEqual({ status: "rate_limited" });
  });

  it("2. EDGE and OWNER can reset an OWNER, while EDGE creates no merchant audit", async () => {
    const business = await createBusiness("reset-owners");
    const firstOwner = await addMember(business, "OWNER", "owner-one");
    const secondOwner = await addMember(business, "OWNER", "owner-two");

    await expect(
      requestReset(business, firstOwner, "OWNER", secondOwner, "owner-reset"),
    ).resolves.toMatchObject({ status: "created" });
    const beforeEdge = (await demoPortalStore.listUserSecurityAudits(business.id)).length;
    await expect(
      requestReset(business, null, "EDGE", firstOwner, "edge-owner-reset"),
    ).resolves.toMatchObject({ status: "created" });
    expect(await demoPortalStore.listUserSecurityAudits(business.id)).toHaveLength(
      beforeEdge,
    );
  });

  it("3. ADMIN and MANAGER reset non-owners but not owners; USER and LITE reset nobody", async () => {
    const business = await createBusiness("reset-matrix");
    const owner = await addMember(business, "OWNER", "owner");
    const admin = await addMember(business, "ADMIN", "admin");
    const manager = await addMember(business, "MANAGER", "manager");
    const user = await addMember(business, "USER", "user");
    const lite = await addMember(business, "LITE", "lite");

    await expect(requestReset(business, admin, "ADMIN", user, "admin-user"))
      .resolves.toMatchObject({ status: "created" });
    await expect(requestReset(business, manager, "MANAGER", lite, "manager-lite"))
      .resolves.toMatchObject({ status: "created" });
    await expect(requestReset(business, admin, "ADMIN", owner, "admin-owner"))
      .resolves.toEqual({ status: "forbidden" });
    await expect(requestReset(business, manager, "MANAGER", owner, "manager-owner"))
      .resolves.toEqual({ status: "forbidden" });
    await expect(requestReset(business, user, "USER", admin, "user-admin"))
      .resolves.toEqual({ status: "forbidden" });
    await expect(requestReset(business, lite, "LITE", user, "lite-user"))
      .resolves.toEqual({ status: "forbidden" });
    expect(await demoPortalStore.listUserSecurityAudits(business.id)).toHaveLength(2);
  });

  it("4. reset targets cannot be selected across businesses", async () => {
    const first = await createBusiness("first-business");
    const second = await createBusiness("second-business");
    const owner = await addMember(first, "OWNER", "owner");
    const outsider = await addMember(second, "USER", "outsider");

    await expect(requestReset(first, owner, "OWNER", outsider, "cross-business"))
      .resolves.toEqual({ status: "not_found" });
  });

  it("5. creating a reset immediately invalidates every existing target session", async () => {
    const business = await createBusiness("session-revocation");
    const owner = await addMember(business, "OWNER", "owner");
    const user = await addMember(business, "USER", "user");
    await demoPortalStore.createSession({
      membershipId: user.id,
      tokenHash: "old-session",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await demoPortalStore.findSession("old-session")).not.toBeNull();

    await requestReset(business, owner, "OWNER", user, "session-reset");
    expect(await demoPortalStore.findSession("old-session")).toBeNull();
  });

  it("6. reset links are single-use and expired links are rejected", async () => {
    const business = await createBusiness("single-use-reset");
    const owner = await addMember(business, "OWNER", "owner");
    const user = await addMember(business, "USER", "user");
    await requestReset(business, owner, "OWNER", user, "single-use");

    await expect(
      demoPortalStore.acceptInvitation({ tokenHash: "single-use", passwordHash: "new" }),
    ).resolves.toBe("accepted");
    await expect(
      demoPortalStore.acceptInvitation({ tokenHash: "single-use", passwordHash: "again" }),
    ).resolves.toBe("invalid");

    await requestReset(business, owner, "OWNER", user, "expired");
    const expired = (await getDemoState()).invitations.find(
      (invitation) => invitation.tokenHash === "expired",
    );
    if (expired) expired.expiresAt = new Date(Date.now() - 1);
    await expect(
      demoPortalStore.acceptInvitation({ tokenHash: "expired", passwordHash: "late" }),
    ).resolves.toBe("invalid");
  });

  it("7. migrated users log in by username while their email identifier is rejected", async () => {
    const business = await createBusiness("username-login");
    const owner = await addMember(business, "OWNER", "owner", "owner@example.com");
    await demoPortalStore.completeUsernameMigration({
      businessId: business.id,
      assignments: [
        { membershipId: owner.id, username: "merchant-owner", usernameNormalized: "merchant-owner" },
      ],
    });

    await expect(
      demoPortalStore.findLoginMembership("merchant-owner", business.id),
    ).resolves.toMatchObject({ id: owner.id });
    await expect(
      demoPortalStore.findLoginMembership("owner@example.com", business.id),
    ).resolves.toBeNull();
  });

  it("8. an invitation cannot claim a username already assigned in the same business", async () => {
    const business = await createBusiness("username-invite-unique");
    const owner = await addMember(business, "OWNER", "owner");
    owner.username = "ExistingUser";
    owner.usernameNormalized = "existinguser";

    await expect(
      demoPortalStore.createInvitation({
        businessId: business.id,
        invitedByMembershipId: owner.id,
        name: "Invitee",
        email: "invitee@example.com",
        username: "existinguser",
        usernameNormalized: "existinguser",
        role: "USER",
        tokenHash: "duplicate-invite",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).resolves.toBe("already_member");
  });

  it("9. username uniqueness and login comparison are case-insensitive", async () => {
    const business = await createBusiness("username-case");
    const owner = await addMember(business, "OWNER", "owner");
    const user = await addMember(business, "USER", "user");

    await expect(
      demoPortalStore.completeUsernameMigration({
        businessId: business.id,
        assignments: [
          { membershipId: owner.id, username: "Alice", usernameNormalized: "alice" },
          { membershipId: user.id, username: "alice", usernameNormalized: "alice" },
        ],
      }),
    ).resolves.toBe("invalid");

    await demoPortalStore.completeUsernameMigration({
      businessId: business.id,
      assignments: [
        { membershipId: owner.id, username: "Alice", usernameNormalized: "alice" },
        { membershipId: user.id, username: "Bob", usernameNormalized: "bob" },
      ],
    });
    await expect(demoPortalStore.findLoginMembership("ALICE", business.id))
      .resolves.toMatchObject({ id: owner.id });
  });

  it("10. bulk cutover refuses partial data and leaves zero existing accounts without usernames", async () => {
    const business = await createBusiness("username-complete");
    const owner = await addMember(business, "OWNER", "owner");
    const admin = await addMember(business, "ADMIN", "admin");
    const user = await addMember(business, "USER", "user");

    await expect(
      demoPortalStore.completeUsernameMigration({
        businessId: business.id,
        assignments: [
          { membershipId: owner.id, username: "owner-user", usernameNormalized: "owner-user" },
        ],
      }),
    ).resolves.toBe("invalid");
    expect(business.usernameLoginEnabledAt).toBeFalsy();

    await expect(
      demoPortalStore.completeUsernameMigration({
        businessId: business.id,
        assignments: [owner, admin, user].map((membership) => ({
          membershipId: membership.id,
          username: `${membership.id}-login`,
          usernameNormalized: `${membership.id}-login`,
        })),
      }),
    ).resolves.toBe("completed");
    expect(
      (await demoPortalStore.listMemberships(business.id)).every((item) => item.username),
    ).toBe(true);
  });

  it("11. email remains contact data on a reset link after username-only cutover", async () => {
    const business = await createBusiness("username-reset-email");
    const owner = await addMember(business, "OWNER", "owner", "contact@example.com");
    await demoPortalStore.completeUsernameMigration({
      businessId: business.id,
      assignments: [
        { membershipId: owner.id, username: "contact-owner", usernameNormalized: "contact-owner" },
      ],
    });

    const result = await requestReset(business, owner, "OWNER", owner, "contact-reset");
    expect(result).toMatchObject({
      status: "created",
      invitation: { email: "contact@example.com", purpose: "PASSWORD_RESET" },
    });
  });
});
