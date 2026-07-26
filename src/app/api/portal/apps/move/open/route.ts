import { NextResponse } from "next/server";
import { launchPortalApplication } from "@/lib/application-launch";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { requireRequestSurface } from "@/lib/surface";

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return launchPortalApplication(request, "move", {
    unauthenticated: "forbidden",
    unavailable: "forbidden",
  });
}
