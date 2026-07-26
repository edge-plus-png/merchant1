import type { Metadata } from "next";
import { ApplicationCard } from "@/components/application-card";
import { canInstallApplication } from "@/lib/auth/authorization";
import { requirePortalContext } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";

export const metadata: Metadata = { title: "My Apps" };

const errorMessages: Record<string, string> = {
  "application-configuration": "The application is not configured for this environment.",
  "application-launch": "The application could not be opened. Please try again.",
  "application-missing": "The application is not available for this merchant.",
};

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; installed?: string }>;
}) {
  const context = await requirePortalContext();
  const store = getPortalStore();
  const applications = await store.listApplications(context.business.id);
  const accessSlugs =
    context.kind === "MERCHANT_USER"
      ? new Set(
          await store.listApplicationAccessSlugs(
            context.business.id,
            context.membershipId,
          ),
        )
      : new Set<string>();
  const canInstall = canInstallApplication(context.role);
  const { error, installed } = await searchParams;

  return (
    <div className="merchant-page applications-page">
      <section className="page-heading merchant-page-heading">
        <p className="legacy-eyebrow">My Apps</p>
        <h1>My Apps</h1>
        <span>Install and open applications for this merchant.</span>
      </section>

      {installed ? (
        <p className="success-notice" role="status">
          Application installed successfully.
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {errorMessages[error] ?? "The application request could not be completed."}
        </p>
      ) : null}

      {applications.length ? (
        <section className="applications-list" aria-label="Merchant applications">
          {applications.map((application) => {
            const canOpen =
              context.kind === "EDGE" ||
              (context.kind === "MERCHANT_USER" &&
                accessSlugs.has(application.slug));

            return (
              <ApplicationCard
                application={application}
                canInstall={canInstall}
                canOpen={canOpen}
                key={application.id}
                openUnavailableReason={
                  context.kind === "HQ_SUPPORT"
                    ? "Open is unavailable during read-only access."
                    : "Your account has not been given access to this application."
                }
              />
            );
          })}
        </section>
      ) : (
        <section className="applications-empty">
          <h2>No applications available</h2>
          <p>This merchant does not have any applications configured.</p>
        </section>
      )}
    </div>
  );
}
