import type { PortalStore } from "@/lib/portal-store/types";
import type {
  BusinessRecord,
  HQAccessAuditRecord,
  HQMembershipRecord,
  HQMerchantStatusAuditRecord,
  HQSessionRecord,
  HQSupportSessionRecord,
  MembershipRecord,
  PortalSessionRecord,
} from "@/lib/portal-types";

export type DemoState = {
  businesses: BusinessRecord[];
  memberships: MembershipRecord[];
  sessions: Map<string, PortalSessionRecord>;
  hqMemberships: HQMembershipRecord[];
  hqAssignments: Array<{
    hqId: string;
    businessId: string;
    removedAt: Date | null;
  }>;
  hqSessions: Map<string, HQSessionRecord>;
  supportSessions: Map<string, HQSupportSessionRecord>;
  consumedTicketNonces: Set<string>;
  hqAccessAudits: HQAccessAuditRecord[];
  hqMerchantStatusAudits: HQMerchantStatusAuditRecord[];
};

const demoGlobal = globalThis as typeof globalThis & {
  portalDemoState?: Promise<DemoState>;
};

async function createDemoState(): Promise<DemoState> {
  return {
    businesses: [],
    memberships: [],
    sessions: new Map(),
    hqMemberships: [],
    hqAssignments: [],
    hqSessions: new Map(),
    supportSessions: new Map(),
    consumedTicketNonces: new Set(),
    hqAccessAudits: [],
    hqMerchantStatusAudits: [],
  };
}

export async function getDemoState() {
  demoGlobal.portalDemoState ??= createDemoState();
  return demoGlobal.portalDemoState;
}

export function resetDemoState() {
  demoGlobal.portalDemoState = createDemoState();
}

export const demoPortalStore: PortalStore = {
  async findLoginMembership(email, businessId) {
    const state = await getDemoState();
    return (
      state.memberships.find(
        (membership) =>
          membership.isActive &&
          membership.user.status === "ACTIVE" &&
          membership.user.email === email &&
          (!businessId || membership.business.id === businessId),
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

  async findLocalBusiness(portalOrigin) {
    const state = await getDemoState();
    return (
      state.businesses.find(
        (business) =>
          business.portalUrl &&
          new URL(business.portalUrl).origin === new URL(portalOrigin).origin,
      ) ?? null
    );
  },

  async consumeTicketAndCreateSupportSession(input) {
    const state = await getDemoState();
    const business = state.businesses.find(
      (item) => item.id === input.businessId,
    );

    if (!business) {
      return "business_missing";
    }

    if (state.consumedTicketNonces.has(input.nonce)) {
      return "replayed";
    }

    state.consumedTicketNonces.add(input.nonce);
    state.supportSessions.set(input.tokenHash, {
      id: `support_session_${crypto.randomUUID()}`,
      expiresAt: input.sessionExpiresAt,
      ticketIssuedAt: input.ticketIssuedAt,
      auditIdentifier: input.auditIdentifier,
      accessMode: input.accessMode,
      business,
      operator: {
        hqId: input.originHqId,
        hqName: input.originHqName,
        userId: input.hqUserId,
        name: input.operatorName,
        email: input.operatorEmail,
      },
    });
    state.hqAccessAudits.push({
      id: `audit_${crypto.randomUUID()}`,
      auditIdentifier: input.auditIdentifier,
      action: "SUPPORT_SESSION_CREATED",
      businessId: business.id,
      businessName: business.name,
      originHqId: input.originHqId,
      originHqName: input.originHqName,
      hqUserId: input.hqUserId,
      operatorName: input.operatorName,
      operatorEmail: input.operatorEmail,
      accessMode: input.accessMode,
      ticketIssuedAt: input.ticketIssuedAt,
      expiresAt: input.sessionExpiresAt,
      createdAt: new Date(),
    });
    return "created";
  },

  async findSupportSession(tokenHash) {
    const state = await getDemoState();
    return state.supportSessions.get(tokenHash) ?? null;
  },

  async deleteSupportSession(tokenHash) {
    const state = await getDemoState();
    state.supportSessions.delete(tokenHash);
  },

  async listHQAccessAuditEvents(businessId) {
    const state = await getDemoState();
    return state.hqAccessAudits
      .filter((event) => event.businessId === businessId)
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  },
};
