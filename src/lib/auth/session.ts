import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieName, getSessionTtlHours } from "@/lib/env";
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
    sessionId: session.id,
    expiresAt: session.expiresAt,
    role: session.membership.role,
    membershipId: session.membership.id,
    user,
    business: session.membership.business,
  };
}

export const getPortalContext = cache(async () => {
  const cookieStore = await cookies();
  return resolvePortalContext(cookieStore.get(getSessionCookieName())?.value);
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
