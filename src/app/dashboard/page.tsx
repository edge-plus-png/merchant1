import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HQShell } from "@/components/hq-shell";
import { requirePortalContext } from "@/lib/auth/session";
import { requireHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { getPortalSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const surface = await getPortalSurface();

  if (surface === "HQ") {
    const context = await requireHQContext();
    const merchants = await getHQStore().listVisibleBusinesses(
      context.hq.id,
      context.hq.type,
    );

    return (
      <HQShell context={context}>
        <section className="page-heading">
          <h1>Dashboard</h1>
          <p>View, create and open merchant Portals.</p>
        </section>
        <section className="summary-panel">
          <div>
            <span>Merchants</span>
            <strong>{merchants.length}</strong>
          </div>
          <div className="summary-actions">
            <Link className="secondary-button" href="/merchants">View merchants</Link>
            <Link className="primary-link-button" href="/merchants/new">New Merchant</Link>
          </div>
        </section>
      </HQShell>
    );
  }

  await requirePortalContext();
  redirect("/business");
}
