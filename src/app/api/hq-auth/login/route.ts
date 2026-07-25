import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { verifyPassword } from "@/lib/auth/password";
import {
  createMfaChallengeToken,
  HQ_AUTH_COOKIE_OPTIONS,
  HQ_MFA_CHALLENGE_COOKIE_NAME,
  normalizeHQUsername,
} from "@/lib/hq-auth/mfa";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

const credentialsSchema = z.object({
  username: z
    .string()
    .transform(normalizeHQUsername)
    .pipe(z.string().min(3).max(64)),
  password: z.string().min(1).max(256),
});

function loginRedirect(request: Request, path = "/login?error=invalid") {
  const publicOrigin = request.headers.get("origin") ?? request.url;
  return NextResponse.redirect(
    new URL(path, publicOrigin),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "HQ")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!(await getHQStore().isSetupComplete())) {
    return NextResponse.redirect(
      new URL("/setup", request.headers.get("origin") ?? request.url),
      { status: 303 },
    );
  }

  const parsed = credentialsSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return loginRedirect(request);
  }

  const store = getHQStore();
  const membership = await store.findLoginMembership(parsed.data.username);
  const passwordMatches = membership
    ? await verifyPassword(parsed.data.password, membership.user.passwordHash)
    : false;

  if (!membership || !passwordMatches) {
    return loginRedirect(request);
  }

  const challenge = createMfaChallengeToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await store.createMfaChallenge({
    membershipId: membership.id,
    tokenHash: challenge.tokenHash,
    expiresAt,
  });
  const response = loginRedirect(request, "/login/mfa");
  response.cookies.set(HQ_MFA_CHALLENGE_COOKIE_NAME, challenge.token, {
    ...HQ_AUTH_COOKIE_OPTIONS,
    expires: expiresAt,
  });
  return response;
}
