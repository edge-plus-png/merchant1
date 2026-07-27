import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { canResetPassword } from "@/lib/auth/authorization";
import { normalizeUsername, usernameSchema } from "@/lib/auth/username";
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
    username: membership.username,
    usernameNormalized: membership.usernameNormalized,
    user: membership.user,
    business: membership.business,
  };
}

export const prismaPortalStore: PortalStore = {
  async findLoginMembership(identifier, businessId) {
    const database = getDb();
    const business = businessId
      ? await database.business.findUnique({ where: { id: businessId } })
      : null;
    const usernameLoginEnabled = Boolean(business?.usernameLoginEnabledAt);
    const membership = await database.businessMembership.findFirst({
      where: {
        businessId,
        isActive: true,
        ...(usernameLoginEnabled
          ? { usernameNormalized: normalizeUsername(identifier) }
          : {}),
        user: {
          status: "ACTIVE",
          ...(usernameLoginEnabled
            ? {}
            : { email: identifier.trim().toLowerCase() }),
        },
      },
      include: membershipInclude,
    });

    return toMembershipRecord(membership);
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
      await database.$transaction(async (transaction) => {
        await transaction.hQAccessTicketNonce.create({
          data: {
            nonce: input.nonce,
            businessId: input.businessId,
            auditIdentifier: input.auditIdentifier,
            expiresAt: input.ticketExpiresAt,
          },
        });
        await transaction.hQSupportSession.create({
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
        });

        if (input.accessMode === "SUPPORT_READ_ONLY") {
          await transaction.hQAccessAuditEvent.create({
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
          });
        }
      });
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
      username: membership.username,
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
        purpose: "INVITE",
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
            OR: [
              { user: { email: input.email } },
              { usernameNormalized: input.usernameNormalized },
            ],
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
              purpose: "INVITE",
              OR: [
                { email: input.email },
                { usernameNormalized: input.usernameNormalized },
              ],
              acceptedAt: null,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          });

        if (existingInvitation) {
          return "already_invited" as const;
        }

        return database.portalUserInvitation.create({
          data: { ...input, purpose: "INVITE" },
        });
      },
      { isolationLevel: "Serializable" },
    );
  },

  async createPasswordReset(input) {
    return getDb().$transaction(
      async (database) => {
        const target = await database.businessMembership.findFirst({
          where: { id: input.targetMembershipId, businessId: input.businessId },
          include: { user: true },
        });
        if (!target) return { status: "not_found" as const };

        if (!canResetPassword(input.actorRole, target.role)) {
          return { status: "forbidden" as const };
        }

        if (input.actorRole !== "EDGE") {
          const actor = input.actorMembershipId
            ? await database.businessMembership.findFirst({
                where: {
                  id: input.actorMembershipId,
                  businessId: input.businessId,
                  isActive: true,
                },
                select: { id: true },
              })
            : null;
          if (!actor) return { status: "forbidden" as const };
        }

        const resetFilter = {
          purpose: "PASSWORD_RESET" as const,
          createdAt: { gte: input.rateWindowStartedAt },
        };
        const [actorRequests, targetRequests] = await Promise.all([
          database.portalUserInvitation.count({
            where: { ...resetFilter, requestedByKey: input.actorKey },
          }),
          database.portalUserInvitation.count({
            where: { ...resetFilter, targetMembershipId: target.id },
          }),
        ]);
        if (actorRequests >= 3 || targetRequests >= 3) {
          return { status: "rate_limited" as const };
        }

        await database.portalUserInvitation.updateMany({
          where: {
            purpose: "PASSWORD_RESET",
            targetMembershipId: target.id,
            acceptedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });

        const invitation = await database.portalUserInvitation.create({
          data: {
            businessId: input.businessId,
            invitedByMembershipId: input.actorMembershipId,
            targetMembershipId: target.id,
            requestedByKey: input.actorKey,
            purpose: "PASSWORD_RESET",
            name: target.user.name,
            email: target.user.email,
            role: target.role,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          },
        });

        await database.portalSession.deleteMany({
          where: { membershipId: target.id },
        });

        if (input.actorRole !== "EDGE" && input.actorMembershipId) {
          await database.portalUserSecurityAuditEvent.create({
            data: {
              businessId: input.businessId,
              actorMembershipId: input.actorMembershipId,
              targetMembershipId: target.id,
              action: "PASSWORD_RESET_REQUESTED",
            },
          });
        }

        return { status: "created" as const, invitation };
      },
      { isolationLevel: "Serializable" },
    );
  },

  async listUserSecurityAudits(businessId) {
    return getDb().portalUserSecurityAuditEvent.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
    });
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

          if (invitation.purpose === "PASSWORD_RESET") {
            const target = invitation.targetMembershipId
              ? await database.businessMembership.findFirst({
                  where: {
                    id: invitation.targetMembershipId,
                    businessId: invitation.businessId,
                  },
                  include: { user: true },
                })
              : null;
            if (!target || target.user.email !== invitation.email) {
              return "invalid" as const;
            }

            await database.portalUser.update({
              where: { id: target.userId },
              data: { passwordHash, status: "ACTIVE" },
            });
            await database.portalSession.deleteMany({
              where: { membershipId: target.id },
            });
            await database.portalUserInvitation.update({
              where: { id: invitation.id },
              data: { acceptedAt: new Date() },
            });
            return "accepted" as const;
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

          const business = await database.business.findUnique({
            where: { id: invitation.businessId },
          });
          if (
            !business ||
            (business.usernameLoginEnabledAt &&
              (!invitation.username || !invitation.usernameNormalized))
          ) {
            return "invalid" as const;
          }

          if (
            invitation.usernameNormalized &&
            (await database.businessMembership.findFirst({
              where: {
                businessId: invitation.businessId,
                usernameNormalized: invitation.usernameNormalized,
              },
              select: { id: true },
            }))
          ) {
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
              username: invitation.username,
              usernameNormalized: invitation.usernameNormalized,
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

  async completeUsernameMigration({ businessId, assignments }) {
    try {
      return await getDb().$transaction(
        async (database) => {
          const business = await database.business.findUnique({
            where: { id: businessId },
          });
          if (!business) return "invalid" as const;
          if (business.usernameLoginEnabledAt) return "already_completed" as const;

          const [memberships, pendingInvitations] = await Promise.all([
            database.businessMembership.findMany({
              where: { businessId },
              select: { id: true },
            }),
            database.portalUserInvitation.findMany({
              where: {
                businessId,
                purpose: "INVITE",
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
              select: { usernameNormalized: true },
            }),
          ]);

          if (pendingInvitations.some((item) => !item.usernameNormalized)) {
            return "pending_invitation_conflict" as const;
          }

          const expectedIds = new Set(memberships.map((item) => item.id));
          const normalized = new Set<string>();
          const reserved = new Set(
            pendingInvitations.flatMap((item) =>
              item.usernameNormalized ? [item.usernameNormalized] : [],
            ),
          );
          if (
            assignments.length !== memberships.length ||
            assignments.some((assignment) => {
              const valid = usernameSchema.safeParse(assignment.username).success;
              const canonical = normalizeUsername(assignment.username);
              const invalid =
                !expectedIds.delete(assignment.membershipId) ||
                !valid ||
                assignment.usernameNormalized !== canonical ||
                normalized.has(canonical) ||
                reserved.has(canonical);
              normalized.add(canonical);
              return invalid;
            }) ||
            expectedIds.size !== 0
          ) {
            return "invalid" as const;
          }

          for (const assignment of assignments) {
            await database.businessMembership.update({
              where: { id: assignment.membershipId },
              data: {
                username: assignment.username.trim(),
                usernameNormalized: assignment.usernameNormalized,
              },
            });
          }
          await database.business.update({
            where: { id: businessId },
            data: { usernameLoginEnabledAt: new Date() },
          });
          return "completed" as const;
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
        return "invalid";
      }
      throw error;
    }
  },

  async revokeInvitation({ businessId, invitationId }) {
    const result = await getDb().portalUserInvitation.updateMany({
      where: {
        id: invitationId,
        businessId,
        purpose: "INVITE",
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
          input.actorRole !== "EDGE" &&
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
          input.actorMembershipId !== null &&
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

  async consumeApplicationReturnStateNonce({ nonce, expiresAt }) {
    try {
      await getDb().$transaction(async (database) => {
        await database.applicationReturnStateNonce.deleteMany({
          where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        });
        await database.applicationReturnStateNonce.create({
          data: { nonce, expiresAt },
        });
      });
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return false;
      }
      throw error;
    }
  },

  async listApplicationAccessSlugs(businessId, membershipId) {
    const access = await getDb().portalCapabilityAccess.findMany({
      where: { businessId, membershipId },
      orderBy: { capabilitySlug: "asc" },
      select: { capabilitySlug: true },
    });

    return access.map((item) => item.capabilitySlug);
  },

  async installApplication(businessId, slug, trustedOrigin) {
    return getDb().$transaction(
      async (database) => {
        const application = await database.merchantApplication.findUnique({
          where: { businessId_slug: { businessId, slug } },
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
