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
import { getRequestOrigin, requireRequestSurface } from "@/lib/surface";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256),
});

function loginRedirect(request: Request, error?: "invalid") {
  const publicOrigin = request.headers.get("origin") ?? request.url;
  const destination = new URL(
    error ? `/login?error=${error}` : "/dashboard",
    publicOrigin,
  );
  return NextResponse.redirect(destination, { status: 303 });
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = credentialsSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return loginRedirect(request, "invalid");
  }

  const store = getPortalStore();
  const business = await store.findLocalBusiness(getRequestOrigin(request));

  if (!business) {
    return new NextResponse("Merchant Portal is not configured.", {
      status: 503,
    });
  }

  const membership = await store.findLoginMembership(
    parsed.data.email,
    business.id,
  );
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
