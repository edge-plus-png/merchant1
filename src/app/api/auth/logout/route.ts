import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import {
  deletePortalSession,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";
import { getSessionCookieName } from "@/lib/env";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const cookieName = getSessionCookieName();
  const cookieHeader = request.headers.get("cookie") ?? "";
  const rawToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  await deletePortalSession(rawToken);
  const response = NextResponse.redirect(
    new URL("/login", request.headers.get("origin") ?? request.url),
    {
    status: 303,
    },
  );
  response.cookies.set(cookieName, "", {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
  });
  return response;
}
