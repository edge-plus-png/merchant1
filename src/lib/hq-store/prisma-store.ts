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
          user: { status: "ACTIVE" },
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
          email: input.email,
          passwordHash: input.passwordHash,
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

  async findLoginMembership(email) {
    const user = await getDb().hQUser.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          include: hqMembershipInclude,
          take: 1,
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return toHQMembershipRecord(user.memberships[0] ?? null);
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
            operatorEmail: input.operatorEmail,
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
      operatorEmail: event.operatorEmail,
      accessMode: event.accessMode,
      ticketIssuedAt: event.ticketIssuedAt,
      expiresAt: event.expiresAt,
      createdAt: event.createdAt,
    }));
  },
};
