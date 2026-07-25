import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getHQSessionCookieName } from "@/lib/env";
import {
  decryptMfaSecret,
  hashMfaChallengeToken,
  HQ_AUTH_COOKIE_OPTIONS,
  HQ_MFA_CHALLENGE_COOKIE_NAME,
  verifyTotpCode,
} from "@/lib/hq-auth/mfa";
import {
  createHQSession,
  HQ_SESSION_COOKIE_OPTIONS,
} from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

function readCookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

function clearChallengeCookie(response: NextResponse) {
  response.cookies.set(HQ_MFA_CHALLENGE_COOKIE_NAME, "", {
    ...HQ_AUTH_COOKIE_OPTIONS,
    expires: new Date(0),
  });
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "HQ")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const token = readCookie(request, HQ_MFA_CHALLENGE_COOKIE_NAME);
  const tokenHash = token ? hashMfaChallengeToken(token) : null;
  const store = getHQStore();
  const challenge = tokenHash ? await store.findMfaChallenge(tokenHash) : null;
  const parsed = codeSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (
    !tokenHash ||
    !challenge ||
    challenge.attempts >= 5 ||
    challenge.expiresAt.getTime() <= Date.now()
  ) {
    if (tokenHash) await store.deleteMfaChallenge(tokenHash);
    const response = redirectTo(request, "/login?error=expired");
    clearChallengeCookie(response);
    return response;
  }

  const secret = decryptMfaSecret(challenge.membership.user.mfaSecretCiphertext);
  if (!parsed.success || !secret || !verifyTotpCode(secret, parsed.data.code)) {
    await store.recordMfaChallengeFailure(tokenHash);
    return redirectTo(request, "/login/mfa?error=invalid");
  }

  if (!(await store.consumeMfaChallenge(tokenHash))) {
    const response = redirectTo(request, "/login?error=expired");
    clearChallengeCookie(response);
    return response;
  }

  const session = await createHQSession(challenge.membership.id);
  const response = redirectTo(request, "/dashboard");
  clearChallengeCookie(response);
  response.cookies.set(getHQSessionCookieName(), session.token, {
    ...HQ_SESSION_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
  return response;
}
