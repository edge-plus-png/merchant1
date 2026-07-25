import { NextResponse } from "next/server";
import { canInstallMove } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext } from "@/lib/auth/session";
import { getMoveApplicationOrigin } from "@/lib/env";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const context = await getPortalContext();
  if (
    !context ||
    context.kind !== "MERCHANT_USER" ||
    !canInstallMove(context.role)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let trustedOrigin: string;
  try {
    trustedOrigin = getMoveApplicationOrigin();
  } catch {
    return redirectTo(request, "/apps?error=move-configuration");
  }

  const result = await getPortalStore().installMove(
    context.business.id,
    trustedOrigin,
  );
  return redirectTo(
    request,
    result.status === "not_found"
      ? "/apps?error=move-missing"
      : "/apps?installed=move",
  );
}
