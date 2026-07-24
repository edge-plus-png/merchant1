import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { requirePortalContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthenticatedPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requirePortalContext();
  return <PortalShell context={context}>{children}</PortalShell>;
}
