import { describe, expect, it } from "vitest";
import { hashSessionToken, resolvePortalContext } from "@/lib/auth/session";
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
    timezone: "Europe/London",
    currency: "GBP",
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
    listMemberships: async () => [membership],
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
});
