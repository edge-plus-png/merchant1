import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getHQSessionCookieName,
  getHQSessionTtlHours,
} from "@/lib/env";
import { getHQStore } from "@/lib/hq-store";
import type { HQContext } from "@/lib/portal-types";

export const HQ_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export function hashHQSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createHQSession(membershipId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + getHQSessionTtlHours() * 60 * 60 * 1000,
  );

  await getHQStore().createSession({
    membershipId,
    tokenHash: hashHQSessionToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function resolveHQContext(
  token: string | undefined,
): Promise<HQContext | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashHQSessionToken(token);
  const session = await getHQStore().findSession(tokenHash);

  if (
    !session ||
    session.expiresAt.getTime() <= Date.now() ||
    !session.membership.isActive ||
    session.membership.user.status !== "ACTIVE"
  ) {
    if (session) {
      await getHQStore().deleteSession(tokenHash);
    }
    return null;
  }

  const {
    passwordHash: _passwordHash,
    mfaSecretCiphertext: _mfaSecretCiphertext,
    ...user
  } = session.membership.user;
  void _passwordHash;
  void _mfaSecretCiphertext;

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    role: session.membership.role,
    membershipId: session.membership.id,
    hq: session.membership.hq,
    user,
  };
}

export const getHQContext = cache(async () => {
  const cookieStore = await cookies();
  return resolveHQContext(cookieStore.get(getHQSessionCookieName())?.value);
});

export async function requireHQContext() {
  const context = await getHQContext();

  if (!context) {
    redirect("/login");
  }

  return context;
}

export async function deleteHQSession(token: string | undefined) {
  if (token) {
    await getHQStore().deleteSession(hashHQSessionToken(token));
  }
}
