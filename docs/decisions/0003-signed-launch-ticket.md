# 0003 — Signed Launch Ticket

## Decision

Every first-party capability is launched using one mechanism: a short-lived, single-use, asymmetrically-signed launch ticket issued directly by the merchant's own Merchant Portal deployment and verified by the capability against that deployment's public key. This replaces Events' existing shared-secret launch approach; no capability keeps its own bespoke SSO scheme.

## Why

Contract 2.0's registration → approval → activation pairing lifecycle, combined with Events building its own separate shared-secret launch mechanism, meant every capability could plausibly diverge in how it authenticates a launch. A shared-secret scheme also means the secret itself is a standing credential that, if leaked, grants ongoing forgery ability. A signed ticket that is short-lived and single-use bounds the damage of any single leaked ticket to one already-expired attempt, and Portal never has to distribute or rotate a shared secret to every capability.

## Alternatives rejected

- **Continue per-capability shared secrets (Events' existing approach)** — rejected: a leaked secret is a standing forgery risk with no expiry, and every capability must independently implement its own verification correctly.
- **Shared cookie / shared session across Portal and capabilities** — rejected, see [`0004-no-shared-cookies.md`](0004-no-shared-cookies.md).
- **Long-lived signed tokens (e.g. valid for the working day)** — rejected: a long validity window increases the value of a leaked or logged ticket; the ticket is only meant to authorize the creation of one session, not to serve as an ongoing credential.

## Consequences

Every capability must implement full verification (signature, audience, environment, expiry, nonce replay) per [`../capabilities/signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md) — there is no partial-trust fallback. Each Merchant Portal deployment runs and secures its own signing key directly (one key per merchant deployment, not a centrally-run service — see [`../platform/portal-architecture.md`](../platform/portal-architecture.md), "Where platform data lives"), and is what must publish rotation in a way capabilities can pick up without a redeploy. If, once several capabilities are consuming structurally identical tickets from several deployments, extracting a shared issuer becomes worthwhile, that is an implementation change, not a change to this decision.
