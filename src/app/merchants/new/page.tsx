import type { Metadata } from "next";
import Link from "next/link";
import { HQShell } from "@/components/hq-shell";
import { requireHQContext } from "@/lib/hq-auth/session";
import { requirePageSurface } from "@/lib/surface";

export const metadata: Metadata = { title: "New Merchant" };

export default async function NewMerchantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageSurface("HQ");
  const [context, params] = await Promise.all([
    requireHQContext(),
    searchParams,
  ]);

  return (
    <HQShell context={context}>
      <Link className="back-link" href="/merchants">← Back to merchants</Link>
      <section className="page-heading compact-heading">
        <h1>New Merchant</h1>
        <p>Create the minimum merchant record required to open its Portal.</p>
      </section>
      <form action="/api/merchants" className="form-panel stacked-form" method="post">
        {params.error ? (
          <p className="form-error" role="alert">
            {params.error === "duplicate"
              ? "That business slug is already in use."
              : "Check the merchant details and try again."}
          </p>
        ) : null}
        <label htmlFor="businessName">Business Name</label>
        <input id="businessName" name="businessName" required />
        <label htmlFor="businessSlug">Business Slug</label>
        <input
          autoCapitalize="none"
          id="businessSlug"
          name="businessSlug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="example-business"
          required
        />
        <label htmlFor="portalUrl">Portal URL</label>
        <input
          autoCapitalize="none"
          id="portalUrl"
          name="portalUrl"
          placeholder="https://merchant.example.com"
          type="url"
        />
        <p className="field-help">Required when the merchant is READY.</p>
        <label htmlFor="status">Status</label>
        <select defaultValue="PROVISIONING" id="status" name="status">
          <option value="PROVISIONING">PROVISIONING</option>
          <option value="READY">READY</option>
        </select>
        <button className="primary-button form-submit" type="submit">Create Merchant</button>
      </form>
    </HQShell>
  );
}
