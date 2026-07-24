# Capability Starter

The standard scaffold every new capability begins from. Move, Events, and Storefront should all converge on this shape — deviations should be a deliberate, documented exception, not drift.

## Required paths

- **`.well-known/getedge-capability.json`** — the capability's published identity: slug, name, contract version, launch URL, health URL, and Registry public-key discovery reference (the Platform Registry, not Portal itself, holds and publishes the signing key — see [`signed-launch-ticket.md`](signed-launch-ticket.md)). See [`capability-contract.md`](capability-contract.md).
- **`api/health`** — a cheap, unauthenticated endpoint Portal can poll to confirm the capability is reachable. Must not depend on the capability's own database being reachable in a way that makes health checks fail during routine maintenance, unless that's the intended signal.
- **`api/portal/launch`** — the endpoint that receives a signed launch ticket, verifies it per [`signed-launch-ticket.md`](signed-launch-ticket.md), and on success creates the capability's own session and redirects into the capability's authenticated area.

## Required behavior

- **Launch ticket verification** — full verification as specified in [`signed-launch-ticket.md`](signed-launch-ticket.md): signature, audience, environment, expiry, nonce replay. No partial acceptance.
- **Merchant session creation** — the capability creates its own session scoped to the merchant identified in the ticket. This session is the capability's alone; Portal has no visibility into it once created.
- **Own-domain configuration** — a capability is reached at its own dedicated domain (see [`../platform/deployment-and-vercel-model.md`](../platform/deployment-and-vercel-model.md): `move-staging`/`move-production` and equivalent per capability). Portal links or redirects a user to that domain with a signed launch ticket; it does not proxy, rewrite, or embed the capability under Portal's own domain. A capability must not hardcode its own domain — it is configuration — but it should not assume it will ever be served under a shared Portal domain or base path either.
- **No-store on authenticated responses** — every authenticated response sets cache headers preventing storage, so a shared or misconfigured cache cannot serve one merchant's session data to another.
- **Direct-origin protection** — the capability rejects requests to its authenticated routes that did not arrive via a valid launched session, regardless of whether the request reached it through Portal's domain or the capability's own origin directly. A capability reachable at its own URL must not be usable by simply guessing that URL.

## Contract tests every capability must pass

Matches [`../delivery/release-checklist.md`](../delivery/release-checklist.md):

- A valid launch ticket for the correct merchant and environment is accepted, and the resulting session reflects the correct merchant.
- An expired ticket is rejected.
- A reused (already-consumed) ticket is rejected.
- A ticket issued for a different capability's audience is rejected.
- A ticket issued for the wrong environment (e.g. staging ticket against a production instance) is rejected.
- Direct access to an authenticated route, without a launched session, is rejected.

## What is intentionally not in the starter

No pairing endpoints, no registration/approval/activation routes, no capability-specific shared-secret exchange. Any of these found in an existing capability during migration to this contract should be removed, not carried forward.
