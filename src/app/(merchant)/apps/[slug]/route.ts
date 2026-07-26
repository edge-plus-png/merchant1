import { NextResponse } from "next/server";
import { launchPortalApplication } from "@/lib/application-launch";
import { requireRequestSurface } from "@/lib/surface";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { slug } = await params;
  return launchPortalApplication(request, slug, {
    unauthenticated: "login",
    unavailable: "apps",
  });
}
