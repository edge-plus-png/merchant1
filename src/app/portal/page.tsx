import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { requirePortalContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Overview" };

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const [context, params] = await Promise.all([
    requirePortalContext(),
    searchParams,
  ]);

  return (
    <div className="page-stack">
      {params.denied ? (
        <div className="access-notice" role="alert">
          You do not have access to {params.denied === "apps" ? "Apps" : "that area"}.
        </div>
      ) : null}
      <section className="page-heading">
        <h1>Overview</h1>
        <p>Your authenticated business context is ready.</p>
      </section>
      <section className="business-context-panel" aria-labelledby="business-context-title">
        <Icon name="business" />
        <div>
          <h2 id="business-context-title">{context.business.name}</h2>
          <p>
            Business ID <code data-testid="business-id">{context.business.id}</code>
          </p>
          <dl className="context-details">
            <div>
              <dt>Portal identifier</dt>
              <dd>{context.business.slug}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{context.business.timezone}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{context.business.currency}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
