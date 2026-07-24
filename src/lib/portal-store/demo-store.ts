import { hashPassword } from "@/lib/auth/password";
import type { PortalStore } from "@/lib/portal-store/types";
import type {
  BusinessRecord,
  MembershipRecord,
  PortalSessionRecord,
  PortalUserRecord,
} from "@/lib/portal-types";

type DemoState = {
  memberships: MembershipRecord[];
  sessions: Map<string, PortalSessionRecord>;
};

const demoGlobal = globalThis as typeof globalThis & {
  portalDemoState?: Promise<DemoState>;
};

async function createDemoState(): Promise<DemoState> {
  const business: BusinessRecord = {
    id: "business_edge_demo",
    slug: "edge-demo",
    name: "Edge Demo Business",
    timezone: "Europe/London",
    currency: "GBP",
  };

  const [ownerHash, liteHash] = await Promise.all([
    hashPassword("OwnerPass123!"),
    hashPassword("LitePass123!"),
  ]);

  const owner: PortalUserRecord = {
    id: "user_owner",
    email: "owner@example.com",
    name: "Alex Morgan",
    passwordHash: ownerHash,
    status: "ACTIVE",
  };
  const lite: PortalUserRecord = {
    id: "user_lite",
    email: "lite@example.com",
    name: "Jamie Taylor",
    passwordHash: liteHash,
    status: "ACTIVE",
  };

  return {
    memberships: [
      {
        id: "membership_owner",
        role: "OWNER",
        isActive: true,
        user: owner,
        business,
      },
      {
        id: "membership_lite",
        role: "LITE",
        isActive: true,
        user: lite,
        business,
      },
    ],
    sessions: new Map(),
  };
}

async function getDemoState() {
  demoGlobal.portalDemoState ??= createDemoState();
  return demoGlobal.portalDemoState;
}

export const demoPortalStore: PortalStore = {
  async findLoginMembership(email) {
    const state = await getDemoState();
    return (
      state.memberships.find(
        (membership) =>
          membership.isActive &&
          membership.user.status === "ACTIVE" &&
          membership.user.email === email,
      ) ?? null
    );
  },

  async createSession({ membershipId, tokenHash, expiresAt }) {
    const state = await getDemoState();
    const membership = state.memberships.find((item) => item.id === membershipId);

    if (!membership) {
      throw new Error("Demo membership not found.");
    }

    state.sessions.set(tokenHash, {
      id: `session_${crypto.randomUUID()}`,
      expiresAt,
      membership,
    });
  },

  async deleteSession(tokenHash) {
    const state = await getDemoState();
    state.sessions.delete(tokenHash);
  },

  async findSession(tokenHash) {
    const state = await getDemoState();
    return state.sessions.get(tokenHash) ?? null;
  },

  async listMemberships(businessId) {
    const state = await getDemoState();
    return state.memberships.filter(
      (membership) => membership.business.id === businessId,
    );
  },
};
