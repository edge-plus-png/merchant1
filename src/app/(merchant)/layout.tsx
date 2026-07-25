import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { requirePortalContext } from "@/lib/auth/session";
import { requirePageSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";

export default async function MerchantLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageSurface("MERCHANT");
  const context = await requirePortalContext();

  return <PortalShell context={context}>{children}</PortalShell>;
}
