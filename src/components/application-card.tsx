import type { MerchantApplicationRecord } from "@/lib/portal-types";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
});

export function ApplicationCard({
  application,
  canInstall,
  canOpen,
  openUnavailableReason,
}: {
  application: MerchantApplicationRecord;
  canInstall: boolean;
  canOpen: boolean;
  openUnavailableReason: string;
}) {
  const installed = application.status === "INSTALLED";

  return (
    <article className="application-card">
      <div className="application-main">
        <span className="application-mark" aria-hidden="true">
          {application.name.charAt(0).toUpperCase()}
        </span>
        <div className="application-copy">
          <h2>{application.name}</h2>
          <p>{application.summary}</p>
        </div>
        <div className="application-action">
          <span
            className={
              installed
                ? "application-status status-installed"
                : "application-status status-not-installed"
            }
          >
            {installed ? "Installed" : "Not installed"}
          </span>
          {installed && application.launchUrl && canOpen ? (
            <form action={`/api/portal/apps/${application.slug}/open`} method="post">
              <button className="merchant-primary-button" type="submit">
                Open {application.name}
              </button>
            </form>
          ) : !installed && canInstall ? (
            <form action={`/api/portal/apps/${application.slug}/install`} method="post">
              <button className="merchant-primary-button" type="submit">
                Install {application.name}
              </button>
            </form>
          ) : !installed ? (
            <p className="application-action-note">
              An Owner or Admin can install {application.name}.
            </p>
          ) : (
            <p className="application-action-note">
              {openUnavailableReason}
            </p>
          )}
        </div>
      </div>
      <dl className="application-meta">
        <div>
          <dt>Installation status</dt>
          <dd>{installed ? "Installed" : "Not installed"}</dd>
        </div>
        {application.installedAt ? (
          <div>
            <dt>Installed on</dt>
            <dd>{dateFormatter.format(application.installedAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Last updated</dt>
          <dd>{dateFormatter.format(application.updatedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}
