import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import type { HQStore } from "@/lib/hq-store/types";
import type { HQMembershipRecord } from "@/lib/portal-types";

const hqMembershipInclude = {
  hq: true,
  user: true,
} as const;

function toHQMembershipRecord(
  membership: Prisma.HQMembershipGetPayload<{
    include: typeof hqMembershipInclude;
  }> | null,
): HQMembershipRecord | null {
  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    role: membership.role,
    isActive: membership.isActive,
    hq: membership.hq,
    user: membership.user,
  };
}

export const prismaHQStore: HQStore = {
  async isSetupComplete() {
    return (
      (await getDb().hQMembership.count({
        where: {
          role: "ADMIN",
          isActive: true,
          hq: { slug: "edge", type: "EDGE" },
          user: {
            status: "ACTIVE",
            mfaEnabledAt: { not: null },
            mfaSecretCiphertext: { not: null },
          },
        },
      })) > 0
    );
  },

  async createEdgeMaster(input) {
    return getDb().$transaction(async (database) => {
      const existing = await database.hQMembership.findFirst({
        where: {
          role: "ADMIN",
          isActive: true,
          hq: { slug: "edge", type: "EDGE" },
          user: { status: "ACTIVE" },
        },
      });

      if (existing) {
        return { status: "already_setup" as const };
      }

      const hq = await database.hQ.upsert({
        where: { slug: "edge" },
        update: { name: input.companyName, type: "EDGE" },
        create: { slug: "edge", name: input.companyName, type: "EDGE" },
      });
      const user = await database.hQUser.create({
        data: {
          name: input.masterName,
          username: input.username,
          passwordHash: input.passwordHash,
          mfaSecretCiphertext: input.mfaSecretCiphertext,
          mfaEnabledAt: input.mfaEnabledAt,
        },
      });
      const membership = await database.hQMembership.create({
        data: { hqId: hq.id, userId: user.id, role: "ADMIN" },
        include: hqMembershipInclude,
      });

      return {
        status: "created" as const,
        membership: toHQMembershipRecord(membership)!,
      };
    }, { isolationLevel: "Serializable" });
  },

  async findLoginMembership(username) {
    const user = await getDb().hQUser.findUnique({
      where: { username },
      include: {
        memberships: {
          where: { isActive: true },
          include: hqMembershipInclude,
          take: 1,
        },
      },
    });

    if (
      !user ||
      user.status !== "ACTIVE" ||
      !user.mfaEnabledAt ||
      !user.mfaSecretCiphertext
    ) {
      return null;
    }

    return toHQMembershipRecord(user.memberships[0] ?? null);
  },

  async createMfaChallenge(input) {
    await getDb().hQMfaChallenge.create({ data: input });
  },

  async findMfaChallenge(tokenHash) {
    return getDb().hQMfaChallenge.findFirst({
      where: {
        tokenHash,
        attempts: { lt: 5 },
        expiresAt: { gt: new Date() },
      },
      include: { membership: { include: hqMembershipInclude } },
    });
  },

  async recordMfaChallengeFailure(tokenHash) {
    await getDb().hQMfaChallenge.updateMany({
      where: { tokenHash, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
  },

  async consumeMfaChallenge(tokenHash) {
    const result = await getDb().hQMfaChallenge.deleteMany({
      where: { tokenHash, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
    });
    return result.count === 1;
  },

  async deleteMfaChallenge(tokenHash) {
    await getDb().hQMfaChallenge.deleteMany({ where: { tokenHash } });
  },

  async createSession(input) {
    await getDb().hQSession.create({ data: input });
  },

  async deleteSession(tokenHash) {
    await getDb().hQSession.deleteMany({ where: { tokenHash } });
  },

  async findSession(tokenHash) {
    const session = await getDb().hQSession.findUnique({
      where: { tokenHash },
      include: { membership: { include: hqMembershipInclude } },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      membership: session.membership,
    };
  },

  async listVisibleBusinesses(hqId, hqType) {
    return getDb().business.findMany({
      where:
        hqType === "EDGE"
          ? undefined
          : {
              hqAssignments: {
                some: { hqId, removedAt: null },
              },
            },
      orderBy: { name: "asc" },
    });
  },

  async findVisibleBusiness(businessId, hqId, hqType) {
    return getDb().business.findFirst({
      where: {
        id: businessId,
        ...(hqType === "EDGE"
          ? {}
          : {
              hqAssignments: {
                some: { hqId, removedAt: null },
              },
            }),
      },
    });
  },

  async createMerchant(input) {
    return getDb().business.create({ data: input });
  },

  async changeMerchantStatus(input) {
    return getDb().$transaction(
      async (database) => {
        const business = await database.business.findUnique({
          where: { id: input.businessId },
        });

        if (!business) {
          return { status: "not_found" as const };
        }

        if (business.status === input.newStatus) {
          return { status: "unchanged" as const, business };
        }

        const updatedBusiness = await database.business.update({
          where: { id: business.id },
          data: { status: input.newStatus },
        });
        const audit = await database.hQMerchantStatusAuditEvent.create({
          data: {
            businessId: business.id,
            previousStatus: business.status,
            newStatus: input.newStatus,
            hqId: input.hqId,
            hqUserId: input.hqUserId,
            operatorName: input.operatorName,
            operatorUsername: input.operatorUsername,
          },
        });

        return {
          status: "changed" as const,
          business: updatedBusiness,
          audit,
        };
      },
      { isolationLevel: "Serializable" },
    );
  },

  async recordTicketIssued(input) {
    await getDb().hQAccessAuditEvent.create({
      data: {
        ...input,
        action: "TICKET_ISSUED",
      },
    });
  },

  async listAuditEvents(hqId, hqType) {
    const events = await getDb().hQAccessAuditEvent.findMany({
      where: {
        action: "TICKET_ISSUED",
        ...(hqType === "EDGE"
          ? {}
          : {
              business: {
                hqAssignments: {
                  some: { hqId, removedAt: null },
                },
              },
            }),
      },
      include: { business: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
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
      operatorUsername: event.operatorUsername,
      accessMode: event.accessMode,
      ticketIssuedAt: event.ticketIssuedAt,
      expiresAt: event.expiresAt,
      createdAt: event.createdAt,
    }));
  },
};
