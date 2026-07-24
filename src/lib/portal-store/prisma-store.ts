import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import type { PortalStore } from "@/lib/portal-store/types";
import type {
  MembershipRecord,
  PortalSessionRecord,
} from "@/lib/portal-types";

const membershipInclude = {
  user: true,
  business: true,
} as const;

function toMembershipRecord(
  membership: Prisma.BusinessMembershipGetPayload<{
    include: typeof membershipInclude;
  }> | null,
): MembershipRecord | null {
  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    role: membership.role,
    isActive: membership.isActive,
    user: membership.user,
    business: membership.business,
  };
}

export const prismaPortalStore: PortalStore = {
  async findLoginMembership(email, businessId) {
    const user = await getDb().portalUser.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true, businessId },
          include: membershipInclude,
          take: 1,
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return toMembershipRecord(user.memberships[0] ?? null);
  },

  async createSession(input) {
    await getDb().portalSession.create({ data: input });
  },

  async deleteSession(tokenHash) {
    await getDb().portalSession.deleteMany({ where: { tokenHash } });
  },

  async findSession(tokenHash) {
    const session = await getDb().portalSession.findUnique({
      where: { tokenHash },
      include: {
        membership: { include: membershipInclude },
      },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      membership: session.membership,
    } satisfies PortalSessionRecord;
  },

  async findLocalBusiness(portalOrigin) {
    const businesses = await getDb().business.findMany({
      take: 2,
      orderBy: { createdAt: "asc" },
    });

    if (businesses.length === 1) {
      return businesses[0];
    }

    return (
      businesses.find(
        (business) =>
          business.portalUrl &&
          new URL(business.portalUrl).origin === new URL(portalOrigin).origin,
      ) ?? null
    );
  },

  async consumeTicketAndCreateSupportSession(input) {
    const database = getDb();
    const business = await database.business.findUnique({
      where: { id: input.businessId },
      select: { id: true },
    });

    if (!business) {
      return "business_missing";
    }

    try {
      await database.$transaction([
        database.hQAccessTicketNonce.create({
          data: {
            nonce: input.nonce,
            businessId: input.businessId,
            auditIdentifier: input.auditIdentifier,
            expiresAt: input.ticketExpiresAt,
          },
        }),
        database.hQSupportSession.create({
          data: {
            tokenHash: input.tokenHash,
            businessId: input.businessId,
            originHqId: input.originHqId,
            originHqName: input.originHqName,
            hqUserId: input.hqUserId,
            operatorName: input.operatorName,
            operatorEmail: input.operatorEmail,
            accessMode: input.accessMode,
            ticketIssuedAt: input.ticketIssuedAt,
            expiresAt: input.sessionExpiresAt,
            auditIdentifier: input.auditIdentifier,
          },
        }),
        database.hQAccessAuditEvent.create({
          data: {
            auditIdentifier: input.auditIdentifier,
            action: "SUPPORT_SESSION_CREATED",
            businessId: input.businessId,
            originHqId: input.originHqId,
            originHqName: input.originHqName,
            hqUserId: input.hqUserId,
            operatorName: input.operatorName,
            operatorEmail: input.operatorEmail,
            accessMode: input.accessMode,
            ticketIssuedAt: input.ticketIssuedAt,
            expiresAt: input.sessionExpiresAt,
          },
        }),
      ]);
      return "created";
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return "replayed";
      }

      throw error;
    }
  },

  async findSupportSession(tokenHash) {
    const session = await getDb().hQSupportSession.findUnique({
      where: { tokenHash },
      include: { business: true },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      ticketIssuedAt: session.ticketIssuedAt,
      auditIdentifier: session.auditIdentifier,
      accessMode: session.accessMode,
      business: session.business,
      operator: {
        hqId: session.originHqId,
        hqName: session.originHqName,
        userId: session.hqUserId,
        name: session.operatorName,
        email: session.operatorEmail,
      },
    };
  },

  async deleteSupportSession(tokenHash) {
    await getDb().hQSupportSession.deleteMany({ where: { tokenHash } });
  },

  async listHQAccessAuditEvents(businessId) {
    const events = await getDb().hQAccessAuditEvent.findMany({
      where: { businessId },
      include: { business: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return events.map((event) => ({
      id: event.id,
      auditIdentifier: event.auditIdentifier,
      action: event.action,
      businessId: event.businessId,
      businessName: event.business.name,
      originHqId: event.originHqId,
      originHqName: event.originHqName,
      hqUserId: event.hqUserId,
      operatorName: event.operatorName,
      operatorEmail: event.operatorEmail,
      accessMode: event.accessMode,
      ticketIssuedAt: event.ticketIssuedAt,
      expiresAt: event.expiresAt,
      createdAt: event.createdAt,
    }));
  },
};
