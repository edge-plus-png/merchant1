import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canAccessArea } from "@/lib/auth/authorization";
import { requirePortalContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Apps" };

export default async function AppsPage() {
  const context = await requirePortalContext();

  if (!canAccessArea(context.role, "APPS")) {
    redirect("/portal?denied=apps");
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <h1>Apps</h1>
        <p>Your approved business applications will appear here.</p>
      </section>
      <section className="apps-empty-state">
        <svg aria-hidden="true" fill="none" viewBox="0 0 64 64">
          <path d="M11 25h42v27H11zM11 25l9-13h24l9 13M24 25v5c0 3 2 5 5 5h6c3 0 5-2 5-5v-5" />
        </svg>
        <h2>No applications available</h2>
        <p>
          Applications will appear after your business is entitled and your account
          is authorised.
        </p>
      </section>
    </div>
  );
}
