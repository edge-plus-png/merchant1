import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import {
  deleteHQSupportSession,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";
import { getHQSupportSessionCookieName } from "@/lib/env";
import { getRequestOrigin, requireRequestSurface } from "@/lib/surface";

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const cookieName = getHQSupportSessionCookieName();
  const rawToken = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  await deleteHQSupportSession(rawToken);
  const response = NextResponse.redirect(new URL("/login", getRequestOrigin(request)), {
    status: 303,
  });
  response.cookies.set(cookieName, "", {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
  });
  return response;
}
