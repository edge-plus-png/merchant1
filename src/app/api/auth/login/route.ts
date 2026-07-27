import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApplicationReturnState } from "@/lib/application-routing/return-state";
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
  email: z.string().email().transform((value) => value.trim().toLowerCase()).optional(),
  username: z.string().trim().min(1).max(64).optional(),
  password: z.string().min(1).max(256),
  state: z.string().max(2048).optional(),
});

function loginRedirect(
  request: Request,
  options: { error?: "invalid"; path?: string; state?: string } = {},
) {
  const publicOrigin = request.headers.get("origin") ?? request.url;
  const destination = new URL(options.path ?? "/business", publicOrigin);
  if (options.error) destination.searchParams.set("error", options.error);
  if (options.state) destination.searchParams.set("state", options.state);
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
    return loginRedirect(request, { error: "invalid", path: "/login" });
  }

  const store = getPortalStore();
  const business = await store.findLocalBusiness(getRequestOrigin(request));

  if (!business) {
    return new NextResponse("Merchant Portal is not configured.", {
      status: 503,
    });
  }

  const membership = await store.findLoginMembership(
    business.usernameLoginEnabledAt
      ? (parsed.data.username ?? "")
      : (parsed.data.email ?? ""),
    business.id,
  );
  const passwordMatches = membership
    ? await verifyPassword(parsed.data.password, membership.user.passwordHash)
    : false;

  if (!membership || !passwordMatches) {
    return loginRedirect(request, {
      error: "invalid",
      path: "/login",
      state: parsed.data.state,
    });
  }

  const session = await createPortalSession(membership.id);
  const returnState = parsed.data.state
    ? verifyApplicationReturnState(parsed.data.state)
    : null;
  const returnStateAccepted = returnState
    ? await store.consumeApplicationReturnStateNonce({
        nonce: returnState.nonce,
        expiresAt: new Date(returnState.expiresAt * 1000),
      })
    : false;
  const response = loginRedirect(request, {
    path: returnStateAccepted ? returnState?.returnPath : "/business",
  });
  response.cookies.set(getSessionCookieName(), session.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
  return response;
}
