import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import {
  deleteHQSession,
  HQ_SESSION_COOKIE_OPTIONS,
} from "@/lib/hq-auth/session";
import { getHQSessionCookieName } from "@/lib/env";
import { requireRequestSurface } from "@/lib/surface";

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "HQ")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const cookieName = getHQSessionCookieName();
  const rawToken = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  await deleteHQSession(rawToken);
  const response = NextResponse.redirect(
    new URL("/login", request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
  response.cookies.set(cookieName, "", {
    ...HQ_SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
  });
  return response;
}
