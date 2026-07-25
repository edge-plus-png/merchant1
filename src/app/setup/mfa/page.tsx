import Image from "next/image";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/logo";
import {
  createTotpUri,
  decryptSetupPayload,
  HQ_SETUP_COOKIE_NAME,
} from "@/lib/hq-auth/mfa";
import { getHQStore } from "@/lib/hq-store";
import { requirePageSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configure MFA" };

export default async function SetupMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageSurface("HQ");

  if (await getHQStore().isSetupComplete()) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const setup = decryptSetupPayload(cookieStore.get(HQ_SETUP_COOKIE_NAME)?.value);
  if (!setup) redirect("/setup?error=expired");

  const { error } = await searchParams;
  const qrCode = await QRCode.toDataURL(
    createTotpUri(setup.username, setup.mfaSecret),
    { errorCorrectionLevel: "M", margin: 1, width: 220 },
  );

  return (
    <main className="setup-page">
      <aside className="setup-brand-panel">
        <Logo linked={false} />
        <div>
          <strong>Protect the master account</strong>
          <span>MFA is required before HQ setup can be completed.</span>
        </div>
      </aside>
      <section className="setup-workspace">
        <div className="setup-card mfa-setup-card">
          <div className="page-heading compact-heading">
            <h1>Configure MFA</h1>
            <p>Scan the code in your authenticator app, then enter its six-digit code.</p>
          </div>
          <div className="mfa-enrolment">
            <Image
              alt="Authenticator setup QR code"
              height={220}
              priority
              src={qrCode}
              unoptimized
              width={220}
            />
            <div>
              <strong>Can&apos;t scan the code?</strong>
              <span>Enter this setup key manually:</span>
              <code>{setup.mfaSecret}</code>
              <span>Account: {setup.username}</span>
            </div>
          </div>
          <form action="/api/setup/mfa" className="stacked-form" method="post">
            {error === "invalid" ? (
              <p className="form-error" role="alert">
                The authenticator code was not recognised. Try the current code.
              </p>
            ) : null}
            <label htmlFor="code">Authenticator code</label>
            <input
              autoComplete="one-time-code"
              autoFocus
              id="code"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="code"
              pattern="[0-9]{6}"
              required
            />
            <button className="primary-button form-submit" type="submit">
              Verify and Create Master Account
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
