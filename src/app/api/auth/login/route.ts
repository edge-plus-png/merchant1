import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { verifyPassword } from "@/lib/auth/password";
import {
  createPortalSession,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";
import { getSessionCookieName } from "@/lib/env";
import { getPortalStore } from "@/lib/portal-store";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256),
});

function loginRedirect(request: Request, error?: "invalid") {
  const publicOrigin = request.headers.get("origin") ?? request.url;
  const destination = new URL(
    error ? `/login?error=${error}` : "/portal",
    publicOrigin,
  );
  return NextResponse.redirect(destination, { status: 303 });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = credentialsSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return loginRedirect(request, "invalid");
  }

  const membership = await getPortalStore().findLoginMembership(parsed.data.email);
  const passwordMatches = membership
    ? await verifyPassword(parsed.data.password, membership.user.passwordHash)
    : false;

  if (!membership || !passwordMatches) {
    return loginRedirect(request, "invalid");
  }

  const session = await createPortalSession(membership.id);
  const response = loginRedirect(request);
  response.cookies.set(getSessionCookieName(), session.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
  return response;
}
