import { NextResponse } from "next/server";
import { z } from "zod";
import { canCompleteUsernameMigration } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext } from "@/lib/auth/session";
import { normalizeUsername, usernameSchema } from "@/lib/auth/username";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

const migrationSchema = z.object({
  assignments: z
    .array(
      z.object({
        membershipId: z.string().min(1).max(160),
        username: usernameSchema,
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const context = await getPortalContext();
  if (!context || !canCompleteUsernameMigration(context.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = migrationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check every username and try again." },
      { status: 400 },
    );
  }

  const result = await getPortalStore().completeUsernameMigration({
    businessId: context.business.id,
    assignments: parsed.data.assignments.map((assignment) => ({
      ...assignment,
      username: assignment.username.trim(),
      usernameNormalized: normalizeUsername(assignment.username),
    })),
  });

  if (result !== "completed" && result !== "already_completed") {
    return NextResponse.json(
      {
        error:
          result === "pending_invitation_conflict"
            ? "Revoke and recreate older pending invitations before enabling username login."
            : "Every account needs a unique valid username.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { status: result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
