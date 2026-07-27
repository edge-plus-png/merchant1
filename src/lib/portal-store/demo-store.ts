import { hashPassword } from "@/lib/auth/password";
import { canResetPassword } from "@/lib/auth/authorization";
import { normalizeUsername, usernameSchema } from "@/lib/auth/username";
import type { PortalStore } from "@/lib/portal-store/types";
import type {
  BusinessRecord,
  HQAccessAuditRecord,
  HQMembershipRecord,
  HQMerchantStatusAuditRecord,
  HQMfaChallengeRecord,
  HQSessionRecord,
  HQSupportSessionRecord,
  MerchantApplicationRecord,
  MembershipRecord,
  PortalSessionRecord,
  PortalUserInvitationRecord,
  PortalUserSecurityAuditRecord,
} from "@/lib/portal-types";

export type DemoState = {
  businesses: BusinessRecord[];
  memberships: MembershipRecord[];
  invitations: Array<
    PortalUserInvitationRecord & {
      invitedByMembershipId: string | null;
      requestedByKey: string | null;
      usernameNormalized: string | null;
      tokenHash: string;
    }
  >;
  applications: MerchantApplicationRecord[];
  capabilityAccess: Array<{
    businessId: string;
    membershipId: string;
    capabilitySlug: string;
  }>;
  sessions: Map<string, PortalSessionRecord>;
  applicationReturnStateNonces: Map<string, Date>;
  hqMemberships: HQMembershipRecord[];
  hqAssignments: Array<{
    hqId: string;
    businessId: string;
    removedAt: Date | null;
  }>;
  hqSessions: Map<string, HQSessionRecord>;
  hqMfaChallenges: Map<string, HQMfaChallengeRecord>;
  supportSessions: Map<string, HQSupportSessionRecord>;
  consumedTicketNonces: Map<
    string,
    {
      businessId: string;
      auditIdentifier: string;
      expiresAt: Date;
      consumedAt: Date;
    }
  >;
  hqAccessAudits: HQAccessAuditRecord[];
  hqMerchantStatusAudits: HQMerchantStatusAuditRecord[];
  userSecurityAudits: PortalUserSecurityAuditRecord[];
};

const demoGlobal = globalThis as typeof globalThis & {
  portalDemoState?: Promise<DemoState>;
};

async function createDemoState(): Promise<DemoState> {
  return {
    businesses: [],
    memberships: [],
    invitations: [],
    applications: [],
    capabilityAccess: [],
    sessions: new Map(),
    applicationReturnStateNonces: new Map(),
    hqMemberships: [],
    hqAssignments: [],
    hqSessions: new Map(),
    hqMfaChallenges: new Map(),
    supportSessions: new Map(),
    consumedTicketNonces: new Map(),
    hqAccessAudits: [],
    hqMerchantStatusAudits: [],
    userSecurityAudits: [],
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
  async findLoginMembership(identifier, businessId) {
    const state = await getDemoState();
    return (
      state.memberships.find(
        (membership) =>
          membership.isActive &&
          membership.user.status === "ACTIVE" &&
          (membership.business.usernameLoginEnabledAt
            ? membership.usernameNormalized === normalizeUsername(identifier)
            : membership.user.email === identifier.trim().toLowerCase()) &&
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
    const business =
      state.businesses.find(
        (business) =>
          business.portalUrl &&
          new URL(business.portalUrl).origin === new URL(portalOrigin).origin,
      ) ?? null;

    if (
      business &&
      !state.memberships.some(
        (membership) => membership.business.id === business.id,
      )
    ) {
      state.memberships.push({
        id: `membership_owner_${business.id}`,
        role: "OWNER",
        isActive: true,
        username: null,
        usernameNormalized: null,
        business,
        user: {
          id: `portal_user_owner_${business.id}`,
          email: `owner@${business.slug}.example`,
          name: "Merchant Owner",
          passwordHash: await hashPassword("OwnerPass123!"),
          status: "ACTIVE",
        },
      });
    }

    return business;
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

    state.consumedTicketNonces.set(input.nonce, {
      businessId: input.businessId,
      auditIdentifier: input.auditIdentifier,
      expiresAt: input.ticketExpiresAt,
      consumedAt: new Date(),
    });
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
        username: input.operatorUsername,
      },
    });
    if (input.accessMode === "SUPPORT_READ_ONLY") {
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
        operatorUsername: input.operatorUsername,
        accessMode: input.accessMode,
        ticketIssuedAt: input.ticketIssuedAt,
        expiresAt: input.sessionExpiresAt,
        createdAt: new Date(),
      });
    }
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

  async cleanupHQAccessRecords({
    supportSessionExpiresAt,
    nonceConsumedBefore,
  }) {
    const state = await getDemoState();
    let expiredSupportSessionsDeleted = 0;
    let oldConsumedNoncesDeleted = 0;

    for (const [tokenHash, session] of state.supportSessions) {
      if (session.expiresAt <= supportSessionExpiresAt) {
        state.supportSessions.delete(tokenHash);
        expiredSupportSessionsDeleted += 1;
      }
    }

    for (const [nonce, record] of state.consumedTicketNonces) {
      if (record.consumedAt < nonceConsumedBefore) {
        state.consumedTicketNonces.delete(nonce);
        oldConsumedNoncesDeleted += 1;
      }
    }

    return {
      expiredSupportSessionsDeleted,
      oldConsumedNoncesDeleted,
    };
  },

  async listHQAccessAuditEvents(businessId) {
    const state = await getDemoState();
    return state.hqAccessAudits
      .filter((event) => event.businessId === businessId)
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  },

  async updateBusiness(input) {
    const state = await getDemoState();
    const business = state.businesses.find(
      (item) => item.id === input.businessId,
    );

    if (!business) {
      return null;
    }

    Object.assign(business, {
      name: input.name,
      legalName: input.legalName,
      supportEmail: input.supportEmail,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      county: input.county,
      postcode: input.postcode,
      countryCode: input.countryCode,
      vatStatus: input.vatStatus,
      vatNumber: input.vatNumber,
      timezone: input.timezone,
      currency: input.currency,
      updatedAt: new Date(),
    });
    return business;
  },

  async listMemberships(businessId) {
    const state = await getDemoState();
    const memberships = state.memberships.filter(
      (membership) => membership.business.id === businessId,
    );
    const primaryOwnerId = memberships.find(
      (membership) => membership.role === "OWNER",
    )?.id;

    return memberships.map((membership) => {
      const lastActiveAt = [...state.sessions.values()]
        .filter((session) => session.membership.id === membership.id)
        .map(() => new Date())
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

      return {
        id: membership.user.id,
        membershipId: membership.id,
        name: membership.user.name,
        email: membership.user.email,
        username: membership.username,
        role: membership.role,
        isActive:
          membership.isActive && membership.user.status === "ACTIVE",
        isPrimaryOwner: membership.id === primaryOwnerId,
        lastActiveAt,
        createdAt: membership.business.createdAt,
      };
    });
  },

  async listPendingInvitations(businessId) {
    const state = await getDemoState();
    return state.invitations
      .filter(
        (invitation) =>
          invitation.businessId === businessId &&
          invitation.purpose === "INVITE" &&
          !invitation.acceptedAt &&
          !invitation.revokedAt &&
          invitation.expiresAt.getTime() > Date.now(),
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  },

  async createInvitation(input) {
    const state = await getDemoState();

    if (
      state.memberships.some(
        (membership) =>
          membership.business.id === input.businessId &&
          (membership.user.email === input.email ||
            membership.usernameNormalized === input.usernameNormalized),
      )
    ) {
      return "already_member";
    }

    if (
      state.invitations.some(
        (invitation) =>
          invitation.businessId === input.businessId &&
          invitation.purpose === "INVITE" &&
          (invitation.email === input.email ||
            invitation.usernameNormalized === input.usernameNormalized) &&
          !invitation.acceptedAt &&
          !invitation.revokedAt &&
          invitation.expiresAt.getTime() > Date.now(),
      )
    ) {
      return "already_invited";
    }

    const invitation = {
      id: `invitation_${crypto.randomUUID()}`,
      businessId: input.businessId,
      invitedByMembershipId: input.invitedByMembershipId,
      name: input.name,
      email: input.email,
      username: input.username,
      usernameNormalized: input.usernameNormalized,
      role: input.role,
      purpose: "INVITE" as const,
      targetMembershipId: null,
      requestedByKey: null,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    state.invitations.push(invitation);
    return invitation;
  },

  async createPasswordReset(input) {
    const state = await getDemoState();
    const target = state.memberships.find(
      (membership) =>
        membership.id === input.targetMembershipId &&
        membership.business.id === input.businessId,
    );
    if (!target) return { status: "not_found" };
    if (!canResetPassword(input.actorRole, target.role)) {
      return { status: "forbidden" };
    }
    if (
      input.actorRole !== "EDGE" &&
      !state.memberships.some(
        (membership) =>
          membership.id === input.actorMembershipId &&
          membership.business.id === input.businessId &&
          membership.isActive,
      )
    ) {
      return { status: "forbidden" };
    }

    const actorRequests = state.invitations.filter(
      (invitation) =>
        invitation.purpose === "PASSWORD_RESET" &&
        invitation.requestedByKey === input.actorKey &&
        invitation.createdAt >= input.rateWindowStartedAt,
    ).length;
    const targetRequests = state.invitations.filter(
      (invitation) =>
        invitation.purpose === "PASSWORD_RESET" &&
        invitation.targetMembershipId === target.id &&
        invitation.createdAt >= input.rateWindowStartedAt,
    ).length;
    if (actorRequests >= 3 || targetRequests >= 3) {
      return { status: "rate_limited" };
    }

    for (const invitation of state.invitations) {
      if (
        invitation.purpose === "PASSWORD_RESET" &&
        invitation.targetMembershipId === target.id &&
        !invitation.acceptedAt &&
        !invitation.revokedAt
      ) {
        invitation.revokedAt = new Date();
      }
    }

    const invitation = {
      id: `password_reset_${crypto.randomUUID()}`,
      businessId: input.businessId,
      invitedByMembershipId: input.actorMembershipId,
      targetMembershipId: target.id,
      requestedByKey: input.actorKey,
      name: target.user.name,
      email: target.user.email,
      username: null,
      usernameNormalized: null,
      role: target.role,
      purpose: "PASSWORD_RESET" as const,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    state.invitations.push(invitation);

    for (const [tokenHash, session] of state.sessions) {
      if (session.membership.id === target.id) state.sessions.delete(tokenHash);
    }

    if (input.actorRole !== "EDGE" && input.actorMembershipId) {
      state.userSecurityAudits.push({
        id: `user_security_audit_${crypto.randomUUID()}`,
        businessId: input.businessId,
        actorMembershipId: input.actorMembershipId,
        targetMembershipId: target.id,
        action: "PASSWORD_RESET_REQUESTED",
        createdAt: new Date(),
      });
    }
    return { status: "created", invitation };
  },

  async listUserSecurityAudits(businessId) {
    const state = await getDemoState();
    return state.userSecurityAudits.filter(
      (audit) => audit.businessId === businessId,
    );
  },

  async findInvitation(tokenHash) {
    const state = await getDemoState();
    return (
      state.invitations.find(
        (invitation) =>
          invitation.tokenHash === tokenHash &&
          !invitation.acceptedAt &&
          !invitation.revokedAt &&
          invitation.expiresAt.getTime() > Date.now(),
      ) ?? null
    );
  },

  async acceptInvitation({ tokenHash, passwordHash }) {
    const state = await getDemoState();
    const invitation = state.invitations.find(
      (item) => item.tokenHash === tokenHash,
    );

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      return "invalid";
    }

    if (invitation.purpose === "PASSWORD_RESET") {
      const target = state.memberships.find(
        (membership) =>
          membership.id === invitation.targetMembershipId &&
          membership.business.id === invitation.businessId &&
          membership.user.email === invitation.email,
      );
      if (!target) return "invalid";
      target.user.passwordHash = passwordHash;
      target.user.status = "ACTIVE";
      for (const [sessionToken, session] of state.sessions) {
        if (session.membership.id === target.id) state.sessions.delete(sessionToken);
      }
      invitation.acceptedAt = new Date();
      return "accepted";
    }

    if (
      state.memberships.some(
        (membership) =>
          membership.business.id === invitation.businessId &&
          membership.user.email === invitation.email,
      )
    ) {
      return "already_member";
    }

    const business = state.businesses.find(
      (item) => item.id === invitation.businessId,
    );
    if (!business) {
      return "invalid";
    }
    if (
      business.usernameLoginEnabledAt &&
      (!invitation.username || !invitation.usernameNormalized)
    ) {
      return "invalid";
    }
    if (
      invitation.usernameNormalized &&
      state.memberships.some(
        (membership) =>
          membership.business.id === invitation.businessId &&
          membership.usernameNormalized === invitation.usernameNormalized,
      )
    ) {
      return "already_member";
    }

    let user = state.memberships
      .map((membership) => membership.user)
      .find((item) => item.email === invitation.email);
    user ??= {
      id: `portal_user_${crypto.randomUUID()}`,
      name: invitation.name,
      email: invitation.email,
      passwordHash,
      status: "ACTIVE",
    };
    user.name = invitation.name;
    user.passwordHash = passwordHash;
    user.status = "ACTIVE";

    state.memberships.push({
      id: `membership_${crypto.randomUUID()}`,
      role: invitation.role,
      isActive: true,
      username: invitation.username,
      usernameNormalized: invitation.usernameNormalized,
      user,
      business,
    });
    invitation.acceptedAt = new Date();
    return "accepted";
  },

  async completeUsernameMigration({ businessId, assignments }) {
    const state = await getDemoState();
    const business = state.businesses.find((item) => item.id === businessId);
    if (!business) return "invalid";
    if (business.usernameLoginEnabledAt) return "already_completed";

    const memberships = state.memberships.filter(
      (membership) => membership.business.id === businessId,
    );
    const pendingInvitations = state.invitations.filter(
      (invitation) =>
        invitation.businessId === businessId &&
        invitation.purpose === "INVITE" &&
        !invitation.acceptedAt &&
        !invitation.revokedAt &&
        invitation.expiresAt > new Date(),
    );
    if (pendingInvitations.some((item) => !item.usernameNormalized)) {
      return "pending_invitation_conflict";
    }

    const expectedIds = new Set(memberships.map((membership) => membership.id));
    const reserved = new Set(
      pendingInvitations.flatMap((item) =>
        item.usernameNormalized ? [item.usernameNormalized] : [],
      ),
    );
    const normalized = new Set<string>();
    if (
      assignments.length !== memberships.length ||
      assignments.some((assignment) => {
        const canonical = normalizeUsername(assignment.username);
        const invalid =
          !expectedIds.delete(assignment.membershipId) ||
          !usernameSchema.safeParse(assignment.username).success ||
          assignment.usernameNormalized !== canonical ||
          normalized.has(canonical) ||
          reserved.has(canonical);
        normalized.add(canonical);
        return invalid;
      }) ||
      expectedIds.size !== 0
    ) {
      return "invalid";
    }

    for (const assignment of assignments) {
      const membership = memberships.find(
        (item) => item.id === assignment.membershipId,
      );
      if (!membership) return "invalid";
      membership.username = assignment.username.trim();
      membership.usernameNormalized = assignment.usernameNormalized;
    }
    business.usernameLoginEnabledAt = new Date();
    return "completed";
  },

  async revokeInvitation({ businessId, invitationId }) {
    const state = await getDemoState();
    const invitation = state.invitations.find(
      (item) =>
        item.id === invitationId &&
        item.businessId === businessId &&
        item.purpose === "INVITE" &&
        !item.acceptedAt &&
        !item.revokedAt,
    );

    if (!invitation) {
      return false;
    }

    invitation.revokedAt = new Date();
    return true;
  },

  async updateMembershipRole(input) {
    const state = await getDemoState();
    const memberships = state.memberships.filter(
      (membership) => membership.business.id === input.businessId,
    );
    const target = memberships.find(
      (membership) => membership.id === input.membershipId,
    );

    if (!target) {
      return "not_found";
    }

    if (
      input.actorRole !== "OWNER" &&
      input.actorRole !== "EDGE" &&
      (target.role === "OWNER" || input.role === "OWNER")
    ) {
      return "owner_required";
    }

    const primaryOwner = memberships.find(
      (membership) => membership.role === "OWNER",
    );
    if (primaryOwner?.id === target.id && input.role !== "OWNER") {
      return "primary_owner";
    }

    if (
      target.role === "OWNER" &&
      input.role !== "OWNER" &&
      memberships.filter(
        (membership) =>
          membership.role === "OWNER" &&
          membership.isActive &&
          membership.user.status === "ACTIVE",
      ).length <= 1
    ) {
      return "last_owner";
    }

    target.role = input.role;
    return "updated";
  },

  async setMembershipActive(input) {
    const state = await getDemoState();
    const memberships = state.memberships.filter(
      (membership) => membership.business.id === input.businessId,
    );
    const target = memberships.find(
      (membership) => membership.id === input.membershipId,
    );

    if (!target) {
      return "not_found";
    }

    if (
      input.actorMembershipId !== null &&
      target.id === input.actorMembershipId &&
      !input.isActive
    ) {
      return "self";
    }

    if (!input.isActive && target.role === "OWNER") {
      const primaryOwner = memberships.find(
        (membership) => membership.role === "OWNER",
      );
      if (primaryOwner?.id === target.id) {
        return "primary_owner";
      }

      if (
        memberships.filter(
          (membership) =>
            membership.role === "OWNER" &&
            membership.isActive &&
            membership.user.status === "ACTIVE",
        ).length <= 1
      ) {
        return "last_owner";
      }
    }

    target.isActive = input.isActive;
    if (!input.isActive) {
      for (const [tokenHash, session] of state.sessions) {
        if (session.membership.id === target.id) {
          state.sessions.delete(tokenHash);
        }
      }
    }
    return "updated";
  },

  async listApplications(businessId) {
    const state = await getDemoState();
    return state.applications
      .filter((application) => application.businessId === businessId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  },

  async consumeApplicationReturnStateNonce({ nonce, expiresAt }) {
    const state = await getDemoState();
    const nonces = state.applicationReturnStateNonces;
    if (nonces.has(nonce)) return false;
    nonces.set(nonce, expiresAt);
    return true;
  },

  async listApplicationAccessSlugs(businessId, membershipId) {
    const state = await getDemoState();
    return state.capabilityAccess
      .filter(
        (access) =>
          access.businessId === businessId &&
          access.membershipId === membershipId,
      )
      .map((access) => access.capabilitySlug)
      .sort();
  },

  async installApplication(businessId, slug, trustedOrigin) {
    const state = await getDemoState();
    const application = state.applications.find(
      (item) => item.businessId === businessId && item.slug === slug,
    );

    if (!application) {
      return { status: "not_found" };
    }

    const alreadyInstalled = application.status === "INSTALLED";
    if (!alreadyInstalled || !application.installedAt || application.launchUrl !== trustedOrigin) {
      application.status = "INSTALLED";
      application.installedAt ??= new Date();
      application.launchUrl = trustedOrigin;
      application.updatedAt = new Date();
    }

    return {
      status: alreadyInstalled ? "already_installed" : "installed",
      application,
    };
  },
};
