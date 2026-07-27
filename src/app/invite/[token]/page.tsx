import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { hashSessionToken } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { requirePageSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accept invitation" };

const roleLabels = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
  LITE: "Lite",
} as const;

export default async function AcceptInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageSurface("MERCHANT");
  const { token } = await params;
  const { error } = await searchParams;
  const invitation = await getPortalStore().findInvitation(
    hashSessionToken(token),
  );
  return (
    <main className="invitation-page">
      <aside className="invitation-brand-panel">
        <Logo linked={false} />
        <p>Merchant workspace</p>
      </aside>
      <section className="invitation-workspace">
        <div className="invitation-card">
          {invitation ? (
            <>
              <div className="page-heading compact-heading">
                <h1>
                  {invitation.purpose === "PASSWORD_RESET"
                    ? "Reset your password"
                    : "Join the team"}
                </h1>
                {invitation.purpose === "PASSWORD_RESET" ? (
                  <p>Create a new password for your merchant account.</p>
                ) : (
                  <p>
                    You&apos;ve been invited as{" "}
                    <strong>{roleLabels[invitation.role]}</strong>.
                  </p>
                )}
              </div>
              <dl className="invitation-details">
                <div>
                  <dt>Name</dt>
                  <dd>{invitation.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{invitation.email}</dd>
                </div>
              </dl>
              <form
                action="/api/invitations/accept"
                className="stacked-form"
                method="post"
              >
                {error ? (
                  <p className="form-error" role="alert">
                    {error === "password"
                      ? "Passwords must match and contain at least 12 characters."
                      : "This invitation could not be accepted."}
                  </p>
                ) : null}
                <input name="token" type="hidden" value={token} />
                <label htmlFor="password">Create password</label>
                <input
                  autoComplete="new-password"
                  id="password"
                  minLength={12}
                  name="password"
                  required
                  type="password"
                />
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  autoComplete="new-password"
                  id="confirmPassword"
                  minLength={12}
                  name="confirmPassword"
                  required
                  type="password"
                />
                <p className="field-help">Use at least 12 characters.</p>
                <button className="primary-button form-submit" type="submit">
                  {invitation.purpose === "PASSWORD_RESET"
                    ? "Update password"
                    : "Accept invitation"}
                </button>
              </form>
            </>
          ) : (
            <div className="expired-invitation">
              <h1>Invitation unavailable</h1>
              <p>
                This link has expired, has already been used, or was revoked.
                Ask an authorised team member for a new link.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
