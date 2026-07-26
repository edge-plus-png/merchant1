import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { fetchCapabilityManifest } from "@/lib/application-routing/manifest";
import { getApplicationGatewaySharedSecret } from "@/lib/env";
import { getPortalStore } from "@/lib/portal-store";
import { getRequestOrigin, requireRequestSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const supplied = request.headers.get("authorization");
  const expected = `Bearer ${getApplicationGatewaySharedSecret()}`;
  if (!supplied) return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

function unavailable() {
  return NextResponse.json(
    { available: false },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!requireRequestSurface(request, "MERCHANT") || !authorized(request)) {
    return unavailable();
  }

  const { slug } = await params;
  const store = getPortalStore();
  const business = await store.findLocalBusiness(getRequestOrigin(request));
  if (!business) return unavailable();

  const application = (await store.listApplications(business.id)).find(
    (item) => item.slug === slug,
  );
  if (
    !application ||
    application.status !== "INSTALLED" ||
    !application.installedAt ||
    !application.launchUrl
  ) {
    return unavailable();
  }

  try {
    const manifest = await fetchCapabilityManifest(application);
    return NextResponse.json(
      {
        available: true,
        slug: manifest.slug,
        applicationOrigin: manifest.applicationOrigin,
        environment: manifest.environment,
        launchUrl: manifest.launchUrl,
        portalRouting: manifest.portalRouting,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return unavailable();
  }
}
