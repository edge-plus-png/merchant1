import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getHQSupportSessionCookieName,
  getHQSupportSessionTtlMinutes,
  getSessionCookieName,
  getSessionTtlHours,
} from "@/lib/env";
import type { HQAccessTicketPayload } from "@/lib/hq-access/ticket";
import { getPortalStore } from "@/lib/portal-store";
import type { PortalStore } from "@/lib/portal-store/types";
import type { PortalContext } from "@/lib/portal-types";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createPortalSession(membershipId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + getSessionTtlHours() * 60 * 60 * 1000,
  );

  await getPortalStore().createSession({
    membershipId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function resolvePortalContext(
  token: string | undefined,
  store: PortalStore = getPortalStore(),
): Promise<PortalContext | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await store.findSession(tokenHash);

  if (
    !session ||
    session.expiresAt.getTime() <= Date.now() ||
    !session.membership.isActive ||
    session.membership.user.status !== "ACTIVE"
  ) {
    if (session) {
      await store.deleteSession(tokenHash);
    }
    return null;
  }

  const { passwordHash: _passwordHash, ...user } = session.membership.user;
  void _passwordHash;

  return {
    kind: "MERCHANT_USER",
    sessionId: session.id,
    expiresAt: session.expiresAt,
    role: session.membership.role,
    membershipId: session.membership.id,
    user,
    business: session.membership.business,
  };
}

export async function createHQSupportSession(payload: HQAccessTicketPayload) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + getHQSupportSessionTtlMinutes() * 60 * 1000,
  );
  const result = await getPortalStore().consumeTicketAndCreateSupportSession({
    tokenHash: hashSessionToken(token),
    nonce: payload.nonce,
    businessId: payload.targetBusiness.id,
    originHqId: payload.originHq.id,
    originHqName: payload.originHq.name,
    hqUserId: payload.operator.id,
    operatorName: payload.operator.name,
    operatorUsername: payload.operator.username,
    accessMode: payload.accessMode,
    ticketIssuedAt: new Date(payload.issuedAt * 1000),
    ticketExpiresAt: new Date(payload.expiresAt * 1000),
    sessionExpiresAt: expiresAt,
    auditIdentifier: payload.auditIdentifier,
  });

  return { result, token, expiresAt };
}

export async function resolveHQSupportContext(token: string | undefined) {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await getPortalStore().findSupportSession(tokenHash);

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await getPortalStore().deleteSupportSession(tokenHash);
    }
    return null;
  }

  return {
    kind: "HQ_SUPPORT" as const,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    role: "HQ_SUPPORT" as const,
    membershipId: null,
    user: {
      id: session.operator.userId,
      username: session.operator.username,
      name: session.operator.name,
      status: "ACTIVE" as const,
    },
    business: session.business,
    support: {
      hqId: session.operator.hqId,
      hqName: session.operator.hqName,
      accessMode: session.accessMode,
      ticketIssuedAt: session.ticketIssuedAt,
      auditIdentifier: session.auditIdentifier,
    },
  };
}

export const getPortalContext = cache(async () => {
  const cookieStore = await cookies();
  const supportContext = await resolveHQSupportContext(
    cookieStore.get(getHQSupportSessionCookieName())?.value,
  );

  return (
    supportContext ??
    resolvePortalContext(cookieStore.get(getSessionCookieName())?.value)
  );
});

export async function requirePortalContext() {
  const context = await getPortalContext();

  if (!context) {
    redirect("/login");
  }

  return context;
}

export async function deletePortalSession(token: string | undefined) {
  if (token) {
    await getPortalStore().deleteSession(hashSessionToken(token));
  }
}

export async function deleteHQSupportSession(token: string | undefined) {
  if (token) {
    await getPortalStore().deleteSupportSession(hashSessionToken(token));
  }
}
