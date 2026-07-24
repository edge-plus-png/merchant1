import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createHQSupportSession,
  resolvePortalContext,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";
import {
  getHQSupportSessionCookieName,
  getSessionCookieName,
} from "@/lib/env";
import { verifyHQAccessTicket } from "@/lib/hq-access/ticket";
import { getPortalStore } from "@/lib/portal-store";
import { getRequestOrigin, requireRequestSurface } from "@/lib/surface";

const exchangeSchema = z.object({
  ticket: z.string().min(64).max(16_384),
});

function readCookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const merchantSession = await resolvePortalContext(
    readCookie(request, getSessionCookieName()),
  );

  if (merchantSession) {
    return new NextResponse(
      "Merchant users cannot exchange HQ access tickets.",
      { status: 403 },
    );
  }

  const parsed = exchangeSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return new NextResponse("Invalid HQ access ticket.", { status: 400 });
  }

  const portalOrigin = getRequestOrigin(request);
  const business = await getPortalStore().findLocalBusiness(portalOrigin);

  if (!business) {
    return new NextResponse("Merchant Portal is not configured.", {
      status: 503,
    });
  }

  const payload = verifyHQAccessTicket(
    parsed.data.ticket,
    { businessId: business.id, portalOrigin },
  );

  if (!payload) {
    return new NextResponse("HQ access ticket is invalid or expired.", {
      status: 401,
    });
  }

  const session = await createHQSupportSession(payload);

  if (session.result === "replayed") {
    return new NextResponse("HQ access ticket has already been used.", {
      status: 409,
    });
  }

  if (session.result === "business_missing") {
    return new NextResponse("Target merchant does not exist.", {
      status: 404,
    });
  }

  const response = NextResponse.redirect(new URL("/dashboard", portalOrigin), {
    status: 303,
  });
  response.cookies.set(getHQSupportSessionCookieName(), session.token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: session.expiresAt,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
