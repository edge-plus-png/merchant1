import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageUsers } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext, hashSessionToken } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

const invitationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "USER"]),
});

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const context = await getPortalContext();

  if (
    !context || !canManageUsers(context.role)
  ) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = invitationSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the name, email, and role." },
      { status: 400 },
    );
  }

  if (
    parsed.data.role === "OWNER" &&
    context.role !== "OWNER" &&
    context.role !== "EDGE"
  ) {
    return NextResponse.json(
      { error: "Only an Owner can invite another Owner." },
      { status: 403 },
    );
  }

  const token = randomBytes(32).toString("base64url");
  const invitation = await getPortalStore().createInvitation({
    businessId: context.business.id,
    invitedByMembershipId: context.membershipId,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  if (invitation === "already_member") {
    return NextResponse.json(
      { error: "That person already belongs to this business." },
      { status: 409 },
    );
  }

  if (invitation === "already_invited") {
    return NextResponse.json(
      { error: "An active invitation already exists for that email." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      invitationUrl: new URL(
        `/invite/${encodeURIComponent(token)}`,
        request.headers.get("origin") ?? request.url,
      ).toString(),
    },
    {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
