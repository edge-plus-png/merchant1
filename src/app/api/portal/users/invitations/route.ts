import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageUsers } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext, hashSessionToken } from "@/lib/auth/session";
import { normalizeUsername, usernameSchema } from "@/lib/auth/username";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

const invitationSchema = z.object({
  purpose: z.literal("INVITE").optional().default("INVITE"),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(254),
  username: usernameSchema,
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "USER", "LITE"]),
});

const resetSchema = z.object({
  purpose: z.literal("PASSWORD_RESET"),
  membershipId: z.string().min(1).max(160),
});

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const context = await getPortalContext();

  if (!context || context.kind === "HQ_SUPPORT") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const fields = Object.fromEntries((await request.formData()).entries());

  if (fields.purpose === "PASSWORD_RESET") {
    const parsedReset = resetSchema.safeParse(fields);
    if (!parsedReset.success) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const token = randomBytes(32).toString("base64url");
    const result = await getPortalStore().createPasswordReset({
      businessId: context.business.id,
      actorMembershipId: context.membershipId,
      actorKey:
        context.kind === "EDGE"
          ? `edge:${context.user.id}`
          : `membership:${context.membershipId}`,
      actorRole: context.role,
      targetMembershipId: parsedReset.data.membershipId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      rateWindowStartedAt: new Date(Date.now() - 15 * 60 * 1000),
    });

    if (result.status !== "created") {
      return NextResponse.json(
        {
          error:
            result.status === "rate_limited"
              ? "Too many reset links have been created. Try again later."
              : "The reset link could not be created.",
        },
        { status: result.status === "rate_limited" ? 429 : 403 },
      );
    }

    return NextResponse.json(
      {
        resetUrl: new URL(
          `/invite/${encodeURIComponent(token)}`,
          request.headers.get("origin") ?? request.url,
        ).toString(),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!canManageUsers(context.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = invitationSchema.safeParse(fields);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the name, username, email, and role." },
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
    username: parsed.data.username.trim(),
    usernameNormalized: normalizeUsername(parsed.data.username),
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
      { error: "That email or username is already in use." },
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
