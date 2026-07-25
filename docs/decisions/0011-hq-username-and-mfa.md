# 0011 — HQ Uses Username Authentication with Required MFA

## Decision

HQ users authenticate with a case-normalised username, not an email address. A
username is unique within the HQ identity store and contains 3–64 letters,
numbers, dots, underscores, or hyphens.

The first-deployment setup requires the master administrator to enter the
password twice and then enrol a time-based one-time password (TOTP)
authenticator. The Edge HQ, master user, and membership are not committed until
the enrolment code has been verified. Setup is permanently disabled only after
that complete operation succeeds.

Normal HQ sign-in is two-stage: username and password create a short-lived,
single-purpose MFA challenge; a valid TOTP code consumes that challenge and only
then creates the normal HQ session. The password step never creates an HQ
session by itself. Challenges expire after five minutes and allow at most five
failed code attempts.

TOTP secrets are encrypted at rest with `HQ_MFA_ENCRYPTION_KEY`. Staging and
production use different 32-byte keys. The key is separate from the HQ merchant
handover signing key.

## Why

HQ is a cross-merchant administrative surface. Requiring a second factor limits
the value of a stolen password, while a username keeps HQ identity independent
from email delivery and merchant-user identity. Completing MFA before the
one-time setup closes prevents an active master account from ever existing in a
password-only state.

## Consequences

HQ operator snapshots in handover tickets and audit evidence carry the stable HQ
username instead of an email address. This changes no identity boundary: the
operator remains an HQ identity and is never provisioned as a merchant user.

The MVP has no self-service MFA reset or recovery-code flow. Losing the sole
master administrator's authenticator therefore requires a separately designed,
audited operational recovery procedure before production onboarding.
