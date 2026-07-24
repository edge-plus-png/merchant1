import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { verifyPassword } from "@/lib/auth/password";
import {
  createHQSession,
  HQ_SESSION_COOKIE_OPTIONS,
} from "@/lib/hq-auth/session";
import { getHQSessionCookieName } from "@/lib/env";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256),
});

function loginRedirect(request: Request, error?: "invalid") {
  const publicOrigin = request.headers.get("origin") ?? request.url;
  return NextResponse.redirect(
    new URL(error ? `/login?error=${error}` : "/dashboard", publicOrigin),
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
    return loginRedirect(request, "invalid");
  }

  const membership = await getHQStore().findLoginMembership(parsed.data.email);
  const passwordMatches = membership
    ? await verifyPassword(parsed.data.password, membership.user.passwordHash)
    : false;

  if (!membership || !passwordMatches) {
    return loginRedirect(request, "invalid");
  }

  const session = await createHQSession(membership.id);
  const response = loginRedirect(request);
  response.cookies.set(getHQSessionCookieName(), session.token, {
    ...HQ_SESSION_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
  return response;
}
