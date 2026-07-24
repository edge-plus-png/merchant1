import { getDemoState } from "@/lib/portal-store/demo-store";
import type { HQStore } from "@/lib/hq-store/types";

export const demoHQStore: HQStore = {
  async isSetupComplete() {
    const state = await getDemoState();
    return state.hqMemberships.some(
      (membership) =>
        membership.isActive &&
        membership.role === "ADMIN" &&
        membership.hq.type === "EDGE" &&
        membership.user.status === "ACTIVE",
    );
  },

  async createEdgeMaster(input) {
    const state = await getDemoState();

    if (
      state.hqMemberships.some(
        (membership) =>
          membership.isActive &&
          membership.role === "ADMIN" &&
          membership.hq.type === "EDGE",
      )
    ) {
      return { status: "already_setup" };
    }

    const membership = {
      id: `hq_membership_${crypto.randomUUID()}`,
      role: "ADMIN" as const,
      isActive: true,
      hq: {
        id: `hq_${crypto.randomUUID()}`,
        slug: "edge",
        name: input.companyName,
        type: "EDGE" as const,
      },
      user: {
        id: `hq_user_${crypto.randomUUID()}`,
        email: input.email,
        name: input.masterName,
        passwordHash: input.passwordHash,
        status: "ACTIVE" as const,
      },
    };
    state.hqMemberships.push(membership);
    return { status: "created", membership };
  },

  async findLoginMembership(email) {
    const state = await getDemoState();
    return (
      state.hqMemberships.find(
        (membership) =>
          membership.isActive &&
          membership.user.status === "ACTIVE" &&
          membership.user.email === email,
      ) ?? null
    );
  },

  async createSession({ membershipId, tokenHash, expiresAt }) {
    const state = await getDemoState();
    const membership = state.hqMemberships.find(
      (item) => item.id === membershipId,
    );

    if (!membership) {
      throw new Error("Demo HQ membership not found.");
    }

    state.hqSessions.set(tokenHash, {
      id: `hq_session_${crypto.randomUUID()}`,
      expiresAt,
      membership,
    });
  },

  async deleteSession(tokenHash) {
    const state = await getDemoState();
    state.hqSessions.delete(tokenHash);
  },

  async findSession(tokenHash) {
    const state = await getDemoState();
    return state.hqSessions.get(tokenHash) ?? null;
  },

  async listVisibleBusinesses(hqId, hqType) {
    const state = await getDemoState();
    return state.businesses.filter(
      (business) =>
        hqType === "EDGE" ||
        state.hqAssignments.some(
          (assignment) =>
            assignment.hqId === hqId &&
            assignment.businessId === business.id &&
            assignment.removedAt === null,
        ),
    );
  },

  async findVisibleBusiness(businessId, hqId, hqType) {
    const state = await getDemoState();
    return (
      state.businesses.find(
        (business) =>
          business.id === businessId &&
          (hqType === "EDGE" ||
            state.hqAssignments.some(
              (assignment) =>
                assignment.hqId === hqId &&
                assignment.businessId === business.id &&
                assignment.removedAt === null,
            )),
      ) ?? null
    );
  },

  async createMerchant(input) {
    const state = await getDemoState();

    if (state.businesses.some((business) => business.slug === input.slug)) {
      throw new Error("A merchant with this slug already exists.");
    }

    const business = {
      id: `business_${crypto.randomUUID()}`,
      slug: input.slug,
      name: input.name,
      portalUrl: input.portalUrl,
      status: input.status,
      timezone: "Europe/London",
      currency: "GBP",
    };
    state.businesses.push(business);
    return business;
  },

  async changeMerchantStatus(input) {
    const state = await getDemoState();
    const business = state.businesses.find(
      (item) => item.id === input.businessId,
    );

    if (!business) {
      return { status: "not_found" };
    }

    if (business.status === input.newStatus) {
      return { status: "unchanged", business };
    }

    const audit = {
      id: `status_audit_${crypto.randomUUID()}`,
      businessId: business.id,
      previousStatus: business.status,
      newStatus: input.newStatus,
      hqId: input.hqId,
      hqUserId: input.hqUserId,
      operatorName: input.operatorName,
      operatorEmail: input.operatorEmail,
      createdAt: new Date(),
    };
    business.status = input.newStatus;
    state.hqMerchantStatusAudits.push(audit);

    return { status: "changed", business, audit };
  },

  async recordTicketIssued(input) {
    const state = await getDemoState();
    const business = state.businesses.find(
      (item) => item.id === input.businessId,
    );

    if (!business) {
      throw new Error("Demo business not found.");
    }

    state.hqAccessAudits.push({
      id: `audit_${crypto.randomUUID()}`,
      auditIdentifier: input.auditIdentifier,
      action: "TICKET_ISSUED",
      businessId: business.id,
      businessName: business.name,
      originHqId: input.originHqId,
      originHqName: input.originHqName,
      hqUserId: input.hqUserId,
      operatorName: input.operatorName,
      operatorEmail: input.operatorEmail,
      accessMode: input.accessMode,
      ticketIssuedAt: input.ticketIssuedAt,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    });
  },

  async listAuditEvents(hqId, hqType) {
    const state = await getDemoState();
    const visibleBusinessIds = new Set(
      state.businesses
        .filter(
          (business) =>
            hqType === "EDGE" ||
            state.hqAssignments.some(
              (assignment) =>
                assignment.hqId === hqId &&
                assignment.businessId === business.id &&
                assignment.removedAt === null,
            ),
        )
        .map((business) => business.id),
    );

    return state.hqAccessAudits
      .filter(
        (event) =>
          event.action === "TICKET_ISSUED" &&
          visibleBusinessIds.has(event.businessId),
      )
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 20);
  },
};
