import type { Metadata } from "next";
import { canManageBusiness } from "@/lib/auth/authorization";
import { requirePortalContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Business profile" };

const vatStatusLabels = {
  NOT_REGISTERED: "Not VAT registered",
  PENDING: "VAT registration pending",
  REGISTERED: "VAT registered",
} as const;

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const context = await requirePortalContext();
  const canEdit = canManageBusiness(context.role);
  const { error, saved } = await searchParams;
  const business = context.business;
  const address = [
    business.addressLine1,
    business.addressLine2,
    business.city,
    business.county,
    business.postcode,
    business.countryCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="merchant-page business-page">
      <section className="legacy-page-heading">
        <p>Settings</p>
        <h1>Business profile</h1>
        <span>Business details and operational preferences.</span>
      </section>

      {context.kind === "HQ_SUPPORT" ? (
        <p className="read-only-notice" role="status">
          You are viewing this business through read-only HQ-managed access.
        </p>
      ) : !canEdit ? (
        <p className="read-only-notice" role="status">
          An Owner or Admin can update business information.
        </p>
      ) : null}

      {saved ? (
        <p className="success-notice" role="status">
          Business information saved.
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          Check the highlighted business details and try again.
        </p>
      ) : null}

      <section className="business-profile-card">
        <div className="profile-card-heading">
          <h2>Merchant Profile</h2>
          <p>
            Keep the business identity, VAT position, and operational details
            shared across Edge Portal and enabled apps.
          </p>
        </div>

        <dl className="business-profile-summary">
          <div>
            <dt>Organisation</dt>
            <dd>
              {business.status === "READY"
                ? "Merchant ready"
                : "Merchant setup pending"}
            </dd>
          </div>
          <div>
            <dt>Merchant display name</dt>
            <dd>{business.name}</dd>
          </div>
          <div>
            <dt>Legal name</dt>
            <dd>{business.legalName || "Not provided"}</dd>
          </div>
          <div>
            <dt>Support email</dt>
            <dd>{business.supportEmail || "Not provided"}</dd>
          </div>
          <div>
            <dt>Business address</dt>
            <dd>{address || "Not provided"}</dd>
          </div>
          <div>
            <dt>VAT status</dt>
            <dd>{vatStatusLabels[business.vatStatus]}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{business.currency}</dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{business.timezone}</dd>
          </div>
        </dl>

        <form action="/api/portal/business" className="business-form" method="post">
          <fieldset disabled={!canEdit}>
            <legend>Business details</legend>
          <div className="business-form-grid">
            <div className="field-group">
              <label htmlFor="name">Merchant display name</label>
              <input
                defaultValue={business.name}
                id="name"
                maxLength={160}
                name="name"
                required
              />
              <p className="field-help">The name shown throughout your Portal.</p>
            </div>
            <div className="field-group">
              <label htmlFor="legalName">Legal business name</label>
              <input
                defaultValue={business.legalName ?? ""}
                id="legalName"
                maxLength={200}
                name="legalName"
                required
              />
              <p className="field-help">Your registered legal business name.</p>
            </div>
            <div className="field-group">
              <label htmlFor="supportEmail">Support email</label>
              <input
                autoComplete="email"
                defaultValue={business.supportEmail ?? ""}
                id="supportEmail"
                maxLength={254}
                name="supportEmail"
                required
                type="email"
              />
            </div>
            <div className="field-group">
              <label htmlFor="contactName">Business contact name</label>
              <input
                autoComplete="name"
                defaultValue={business.contactName ?? ""}
                id="contactName"
                maxLength={160}
                name="contactName"
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="contactPhone">Business contact phone</label>
              <input
                autoComplete="tel"
                defaultValue={business.contactPhone ?? ""}
                id="contactPhone"
                maxLength={40}
                name="contactPhone"
                required
                type="tel"
              />
            </div>
            <div className="field-group">
              <label htmlFor="addressLine1">Address line 1</label>
              <input
                autoComplete="address-line1"
                defaultValue={business.addressLine1 ?? ""}
                id="addressLine1"
                maxLength={200}
                name="addressLine1"
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="addressLine2">Address line 2</label>
              <input
                autoComplete="address-line2"
                defaultValue={business.addressLine2 ?? ""}
                id="addressLine2"
                maxLength={200}
                name="addressLine2"
              />
              <p className="field-help">Optional</p>
            </div>
            <div className="field-group">
              <label htmlFor="city">Town / city</label>
              <input
                autoComplete="address-level2"
                defaultValue={business.city ?? ""}
                id="city"
                maxLength={120}
                name="city"
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="county">County</label>
              <input
                autoComplete="address-level1"
                defaultValue={business.county ?? ""}
                id="county"
                maxLength={120}
                name="county"
              />
              <p className="field-help">Optional</p>
            </div>
            <div className="field-group">
              <label htmlFor="postcode">Postcode</label>
              <input
                autoComplete="postal-code"
                defaultValue={business.postcode ?? ""}
                id="postcode"
                maxLength={20}
                name="postcode"
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="countryCode">Country code</label>
              <input
                autoComplete="country"
                defaultValue={business.countryCode}
                id="countryCode"
                maxLength={2}
                minLength={2}
                name="countryCode"
                pattern="[A-Za-z]{2}"
                required
              />
              <p className="field-help">Two-letter ISO code, for example GB.</p>
            </div>
            <div className="field-group">
              <label htmlFor="vatStatus">VAT status</label>
              <select
                defaultValue={business.vatStatus}
                id="vatStatus"
                name="vatStatus"
              >
                {Object.entries(vatStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="vatNumber">VAT number</label>
              <input
                defaultValue={business.vatNumber ?? ""}
                id="vatNumber"
                maxLength={40}
                name="vatNumber"
              />
              <p className="field-help">Required when VAT registered.</p>
            </div>
            <div className="field-group">
              <label htmlFor="timezone">Timezone</label>
              <input
                defaultValue={business.timezone}
                id="timezone"
                maxLength={80}
                name="timezone"
                required
              />
              <p className="field-help">IANA timezone, for example Europe/London.</p>
            </div>
            <div className="field-group">
              <label htmlFor="currency">Currency</label>
              <input
                defaultValue={business.currency}
                id="currency"
                maxLength={3}
                minLength={3}
                name="currency"
                pattern="[A-Za-z]{3}"
                required
              />
              <p className="field-help">Three-letter ISO code, for example GBP.</p>
            </div>
          </div>
          </fieldset>

        {canEdit ? (
          <div className="sticky-form-actions">
            <button className="merchant-primary-button" type="submit">
              Save changes
            </button>
            <span>
              Last updated{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(business.updatedAt)}
            </span>
          </div>
        ) : null}
        </form>
      </section>
    </div>
  );
}
