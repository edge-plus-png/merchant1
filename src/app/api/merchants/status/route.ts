import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { requireHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { getRequestOrigin, requireRequestSurface } from "@/lib/surface";

const statusSchema = z.object({
  businessId: z.string().min(1),
  status: z.enum(["PROVISIONING", "READY"]),
});

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "HQ")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const context = await requireHQContext();

  if (context.hq.type !== "EDGE" || context.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = statusSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return new NextResponse("Invalid merchant status.", { status: 400 });
  }

  const store = getHQStore();
  const visibleBusiness = await store.findVisibleBusiness(
    parsed.data.businessId,
    context.hq.id,
    context.hq.type,
  );

  if (!visibleBusiness) {
    return new NextResponse("Merchant not found.", { status: 404 });
  }

  const result = await store.changeMerchantStatus({
    businessId: visibleBusiness.id,
    newStatus: parsed.data.status,
    hqId: context.hq.id,
    hqUserId: context.user.id,
    operatorName: context.user.name,
    operatorUsername: context.user.username,
  });

  if (result.status === "not_found") {
    return new NextResponse("Merchant not found.", { status: 404 });
  }

  return NextResponse.redirect(
    new URL(
      `/merchants?updated=${encodeURIComponent(visibleBusiness.slug)}`,
      getRequestOrigin(request),
    ),
    { status: 303 },
  );
}
