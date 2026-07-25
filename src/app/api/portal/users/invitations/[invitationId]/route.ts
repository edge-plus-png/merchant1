import { NextResponse } from "next/server";
import { canManageUsers } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const context = await getPortalContext();

  if (
    !context || !canManageUsers(context.role)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { invitationId } = await params;
  const revoked = await getPortalStore().revokeInvitation({
    businessId: context.business.id,
    invitationId,
  });

  return redirectTo(
    request,
    revoked ? "/users?updated=invite" : "/users?error=invalid",
  );
}
