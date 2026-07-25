import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import type { PortalStore } from "@/lib/portal-store/types";
import type { MembershipRecord, PortalSessionRecord } from "@/lib/portal-types";

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
            operatorUsername: input.operatorUsername,
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
            operatorUsername: input.operatorUsername,
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
        username: session.operatorUsername,
      },
    };
  },

  async deleteSupportSession(tokenHash) {
    await getDb().hQSupportSession.deleteMany({ where: { tokenHash } });
  },

  async cleanupHQAccessRecords({
    supportSessionExpiresAt,
    nonceConsumedBefore,
  }) {
    const database = getDb();
    const [supportSessions, ticketNonces] = await database.$transaction([
      database.hQSupportSession.deleteMany({
        where: { expiresAt: { lte: supportSessionExpiresAt } },
      }),
      database.hQAccessTicketNonce.deleteMany({
        where: { consumedAt: { lt: nonceConsumedBefore } },
      }),
    ]);

    return {
      expiredSupportSessionsDeleted: supportSessions.count,
      oldConsumedNoncesDeleted: ticketNonces.count,
    };
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
      operatorUsername: event.operatorUsername,
      accessMode: event.accessMode,
      ticketIssuedAt: event.ticketIssuedAt,
      expiresAt: event.expiresAt,
      createdAt: event.createdAt,
    }));
  },

  async updateBusiness(input) {
    const { businessId, ...data } = input;
    const result = await getDb().business.updateMany({
      where: { id: businessId },
      data,
    });

    return result.count === 1
      ? getDb().business.findUnique({ where: { id: businessId } })
      : null;
  },

  async listMemberships(businessId) {
    const memberships = await getDb().businessMembership.findMany({
      where: { businessId },
      include: {
        user: true,
        sessions: {
          orderBy: { lastSeenAt: "desc" },
          take: 1,
          select: { lastSeenAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const primaryOwnerId = memberships.find(
      (membership) => membership.role === "OWNER",
    )?.id;

    return memberships.map((membership) => ({
      id: membership.user.id,
      membershipId: membership.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      isActive:
        membership.isActive && membership.user.status === "ACTIVE",
      isPrimaryOwner: membership.id === primaryOwnerId,
      lastActiveAt: membership.sessions[0]?.lastSeenAt ?? null,
      createdAt: membership.createdAt,
    }));
  },

  async listPendingInvitations(businessId) {
    return getDb().portalUserInvitation.findMany({
      where: {
        businessId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async createInvitation(input) {
    return getDb().$transaction(
      async (database) => {
        const existingMember = await database.businessMembership.findFirst({
          where: {
            businessId: input.businessId,
            user: { email: input.email },
          },
          select: { id: true },
        });

        if (existingMember) {
          return "already_member" as const;
        }

        const existingInvitation =
          await database.portalUserInvitation.findFirst({
            where: {
              businessId: input.businessId,
              email: input.email,
              acceptedAt: null,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          });

        if (existingInvitation) {
          return "already_invited" as const;
        }

        return database.portalUserInvitation.create({ data: input });
      },
      { isolationLevel: "Serializable" },
    );
  },

  async findInvitation(tokenHash) {
    return getDb().portalUserInvitation.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  async acceptInvitation({ tokenHash, passwordHash }) {
    try {
      return await getDb().$transaction(
        async (database) => {
          const invitation = await database.portalUserInvitation.findUnique({
            where: { tokenHash },
          });

          if (
            !invitation ||
            invitation.acceptedAt ||
            invitation.revokedAt ||
            invitation.expiresAt.getTime() <= Date.now()
          ) {
            return "invalid" as const;
          }

          const existingMembership =
            await database.businessMembership.findFirst({
              where: {
                businessId: invitation.businessId,
                user: { email: invitation.email },
              },
              select: { id: true },
            });

          if (existingMembership) {
            return "already_member" as const;
          }

          const user = await database.portalUser.upsert({
            where: { email: invitation.email },
            update: {
              name: invitation.name,
              passwordHash,
              status: "ACTIVE",
            },
            create: {
              name: invitation.name,
              email: invitation.email,
              passwordHash,
            },
          });

          await database.businessMembership.create({
            data: {
              businessId: invitation.businessId,
              userId: user.id,
              role: invitation.role,
            },
          });
          await database.portalUserInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
          });

          return "accepted" as const;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return "already_member";
      }

      throw error;
    }
  },

  async revokeInvitation({ businessId, invitationId }) {
    const result = await getDb().portalUserInvitation.updateMany({
      where: {
        id: invitationId,
        businessId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  },

  async updateMembershipRole(input) {
    return getDb().$transaction(
      async (database) => {
        const target = await database.businessMembership.findFirst({
          where: {
            id: input.membershipId,
            businessId: input.businessId,
          },
        });

        if (!target) {
          return "not_found" as const;
        }

        if (
          input.actorRole !== "OWNER" &&
          (target.role === "OWNER" || input.role === "OWNER")
        ) {
          return "owner_required" as const;
        }

        const primaryOwner = await database.businessMembership.findFirst({
          where: { businessId: input.businessId, role: "OWNER" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

        if (
          primaryOwner?.id === target.id &&
          input.role !== "OWNER"
        ) {
          return "primary_owner" as const;
        }

        if (target.role === "OWNER" && input.role !== "OWNER") {
          const activeOwnerCount = await database.businessMembership.count({
            where: {
              businessId: input.businessId,
              role: "OWNER",
              isActive: true,
              user: { status: "ACTIVE" },
            },
          });

          if (activeOwnerCount <= 1) {
            return "last_owner" as const;
          }
        }

        await database.businessMembership.update({
          where: { id: target.id },
          data: { role: input.role },
        });
        return "updated" as const;
      },
      { isolationLevel: "Serializable" },
    );
  },

  async setMembershipActive(input) {
    return getDb().$transaction(
      async (database) => {
        const target = await database.businessMembership.findFirst({
          where: {
            id: input.membershipId,
            businessId: input.businessId,
          },
        });

        if (!target) {
          return "not_found" as const;
        }

        if (
          input.actorMembershipId === target.id &&
          !input.isActive
        ) {
          return "self" as const;
        }

        if (!input.isActive && target.role === "OWNER") {
          const primaryOwner = await database.businessMembership.findFirst({
            where: { businessId: input.businessId, role: "OWNER" },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });

          if (primaryOwner?.id === target.id) {
            return "primary_owner" as const;
          }

          const activeOwnerCount = await database.businessMembership.count({
            where: {
              businessId: input.businessId,
              role: "OWNER",
              isActive: true,
              user: { status: "ACTIVE" },
            },
          });

          if (activeOwnerCount <= 1) {
            return "last_owner" as const;
          }
        }

        await database.businessMembership.update({
          where: { id: target.id },
          data: { isActive: input.isActive },
        });

        if (!input.isActive) {
          await database.portalSession.deleteMany({
            where: { membershipId: target.id },
          });
        }

        return "updated" as const;
      },
      { isolationLevel: "Serializable" },
    );
  },

  async listApplications(businessId) {
    return getDb().merchantApplication.findMany({
      where: { businessId },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    });
  },

  async installMove(businessId, trustedOrigin) {
    return getDb().$transaction(
      async (database) => {
        const application = await database.merchantApplication.findUnique({
          where: { businessId_slug: { businessId, slug: "move" } },
        });

        if (!application) {
          return { status: "not_found" as const };
        }

        const installation = await database.merchantApplication.updateMany({
          where: { id: application.id, status: "NOT_INSTALLED" },
          data: {
            status: "INSTALLED",
            installedAt: new Date(),
            launchUrl: trustedOrigin,
          },
        });
        const installedApplication = await database.merchantApplication.update({
          where: { id: application.id },
          data: {
            launchUrl: trustedOrigin,
            installedAt:
              application.status === "INSTALLED" && !application.installedAt
                ? new Date()
                : undefined,
          },
        });

        return {
          status:
            installation.count === 1
              ? ("installed" as const)
              : ("already_installed" as const),
          application: installedApplication,
        };
      },
    );
  },
};
