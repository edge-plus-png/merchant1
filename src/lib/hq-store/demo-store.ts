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
        membership.user.status === "ACTIVE" &&
        membership.user.mfaEnabledAt !== null &&
        membership.user.mfaSecretCiphertext !== null,
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
        username: input.username,
        name: input.masterName,
        passwordHash: input.passwordHash,
        mfaSecretCiphertext: input.mfaSecretCiphertext,
        mfaEnabledAt: input.mfaEnabledAt,
        status: "ACTIVE" as const,
      },
    };
    state.hqMemberships.push(membership);
    return { status: "created", membership };
  },

  async findLoginMembership(username) {
    const state = await getDemoState();
    return (
      state.hqMemberships.find(
        (membership) =>
          membership.isActive &&
          membership.user.status === "ACTIVE" &&
          membership.user.username === username &&
          membership.user.mfaEnabledAt !== null &&
          membership.user.mfaSecretCiphertext !== null,
      ) ?? null
    );
  },

  async createMfaChallenge({ membershipId, tokenHash, expiresAt }) {
    const state = await getDemoState();
    const membership = state.hqMemberships.find(
      (item) => item.id === membershipId,
    );
    if (!membership) throw new Error("Demo HQ membership not found.");
    state.hqMfaChallenges.set(tokenHash, {
      tokenHash,
      attempts: 0,
      expiresAt,
      membership,
    });
  },

  async findMfaChallenge(tokenHash) {
    const state = await getDemoState();
    const challenge = state.hqMfaChallenges.get(tokenHash);
    return challenge && challenge.attempts < 5 && challenge.expiresAt > new Date()
      ? challenge
      : null;
  },

  async recordMfaChallengeFailure(tokenHash) {
    const state = await getDemoState();
    const challenge = state.hqMfaChallenges.get(tokenHash);
    if (challenge && challenge.attempts < 5) challenge.attempts += 1;
  },

  async consumeMfaChallenge(tokenHash) {
    const state = await getDemoState();
    const challenge = state.hqMfaChallenges.get(tokenHash);
    if (!challenge || challenge.attempts >= 5 || challenge.expiresAt <= new Date()) {
      return false;
    }
    return state.hqMfaChallenges.delete(tokenHash);
  },

  async deleteMfaChallenge(tokenHash) {
    const state = await getDemoState();
    state.hqMfaChallenges.delete(tokenHash);
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

    const now = new Date();
    const business = {
      id: `business_${crypto.randomUUID()}`,
      slug: input.slug,
      name: input.name,
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
      vatStatus: "NOT_REGISTERED" as const,
      vatNumber: null,
      portalUrl: input.portalUrl,
      status: input.status,
      timezone: "Europe/London",
      currency: "GBP",
      createdAt: now,
      updatedAt: now,
    };
    state.businesses.push(business);
    state.applications.push({
      id: `application_${crypto.randomUUID()}`,
      businessId: business.id,
      slug: "move",
      name: "Move",
      summary: "Manage your Move access for this business.",
      status: "NOT_INSTALLED",
      launchUrl: null,
      installedAt: null,
      createdAt: now,
      updatedAt: now,
    });
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
      operatorUsername: input.operatorUsername,
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
      operatorUsername: input.operatorUsername,
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
