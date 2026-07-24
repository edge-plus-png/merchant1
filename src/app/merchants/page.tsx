import type { Metadata } from "next";
import Link from "next/link";
import { HQShell } from "@/components/hq-shell";
import { requireHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { requirePageSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Merchants" };

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  await requirePageSurface("HQ");
  const [context, params] = await Promise.all([
    requireHQContext(),
    searchParams,
  ]);
  const businesses = await getHQStore().listVisibleBusinesses(
    context.hq.id,
    context.hq.type,
  );

  return (
    <HQShell context={context}>
      {params.created || params.updated ? (
        <div className="success-notice" role="status">
          {params.updated
            ? "Merchant status updated."
            : "Merchant directory record created."}
        </div>
      ) : null}
      <section className="page-heading heading-with-action">
        <div>
          <h1>Merchants</h1>
          <p>Create a merchant or open its own Portal with an HQ-managed session.</p>
        </div>
        <Link className="secondary-button" href="/merchants/new">
          New Merchant
        </Link>
      </section>
      {businesses.length ? (
        <div className="table-frame hq-merchant-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Business</th>
                <th scope="col">Slug</th>
                <th scope="col">Status</th>
                <th scope="col">Portal URL</th>
                <th scope="col"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody data-testid="merchant-list">
              {businesses.map((business) => (
                <tr data-business-id={business.id} key={business.id}>
                  <td data-label="Business"><strong>{business.name}</strong></td>
                  <td data-label="Slug"><code>{business.slug}</code></td>
                  <td data-label="Status">
                    <form
                      action="/api/merchants/status"
                      className="merchant-status-control"
                      method="post"
                    >
                      <input name="businessId" type="hidden" value={business.id} />
                      <label className="sr-only" htmlFor={`status-${business.id}`}>
                        Status for {business.name}
                      </label>
                      <select
                        defaultValue={business.status}
                        id={`status-${business.id}`}
                        name="status"
                      >
                        <option value="PROVISIONING">PROVISIONING</option>
                        <option value="READY">READY</option>
                      </select>
                      <button type="submit">Save</button>
                    </form>
                  </td>
                  <td className="portal-url-cell" data-label="Portal URL">
                    {business.portalUrl ?? "—"}
                  </td>
                  <td data-label="Action">
                    {business.status === "READY" && business.portalUrl ? (
                      <form action="/api/merchant-access" method="post">
                        <input name="businessId" type="hidden" value={business.id} />
                        <button className="merchant-open-button" type="submit">
                          Open Merchant
                        </button>
                      </form>
                    ) : (
                      <span className="muted-copy">Not ready</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="empty-panel">
          <h2>No merchants yet</h2>
          <p>Create the first merchant to add it to HQ.</p>
          <Link className="secondary-button" href="/merchants/new">New Merchant</Link>
        </section>
      )}
    </HQShell>
  );
}
