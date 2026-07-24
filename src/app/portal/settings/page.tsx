import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canAccessArea } from "@/lib/auth/authorization";
import { requirePortalContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const context = await requirePortalContext();

  if (!canAccessArea(context.role, "SETTINGS")) {
    redirect("/portal?denied=settings");
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <h1>Settings</h1>
        <p>Shared business settings for this merchant deployment.</p>
      </section>
      <section className="settings-list" aria-label="Business settings">
        <div>
          <span>Business name</span>
          <strong>{context.business.name}</strong>
        </div>
        <div>
          <span>Portal identifier</span>
          <strong>{context.business.slug}</strong>
        </div>
        <div>
          <span>Timezone</span>
          <strong>{context.business.timezone}</strong>
        </div>
        <div>
          <span>Currency</span>
          <strong>{context.business.currency}</strong>
        </div>
      </section>
    </div>
  );
}
