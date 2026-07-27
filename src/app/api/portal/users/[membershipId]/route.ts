import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageUsers } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

const membershipChangeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("role"),
    role: z.enum(["OWNER", "ADMIN", "MANAGER", "USER", "LITE"]),
  }),
  z.object({
    action: z.literal("active"),
    isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
  }),
]);

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
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

  const parsed = membershipChangeSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return redirectTo(request, "/users?error=invalid");
  }

  const { membershipId } = await params;
  const store = getPortalStore();
  const result =
    parsed.data.action === "role"
      ? await store.updateMembershipRole({
          businessId: context.business.id,
          actorMembershipId: context.membershipId,
          actorRole: context.role,
          membershipId,
          role: parsed.data.role,
        })
      : await store.setMembershipActive({
          businessId: context.business.id,
          actorMembershipId: context.membershipId,
          membershipId,
          isActive: parsed.data.isActive,
        });

  return redirectTo(
    request,
    result === "updated" ? "/users?updated=1" : `/users?error=${result}`,
  );
}
