import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
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
  async findLoginMembership(email) {
    const user = await db.portalUser.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
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
    await db.portalSession.create({ data: input });
  },

  async deleteSession(tokenHash) {
    await db.portalSession.deleteMany({ where: { tokenHash } });
  },

  async findSession(tokenHash) {
    const session = await db.portalSession.findUnique({
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

  async listMemberships(businessId) {
    const memberships = await db.businessMembership.findMany({
      where: { businessId },
      include: membershipInclude,
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    });

    return memberships;
  },
};
