# Capability Contract

This replaces Contract 2.0's per-merchant pairing lifecycle (registration → approval → activation). There is no pairing state machine in Portal v2. A capability's relationship to Portal is defined once, globally; a merchant's access to it is a single on/off grant.

This contract is what every capability implements regardless of how it joined the platform — there are exactly two onboarding routes, migrating an existing application or building a new one from the capability starter, and both converge on this same contract. See [`../decisions/0013-two-onboarding-routes.md`](../decisions/0013-two-onboarding-routes.md).

## Product boundaries: what a capability owns

Applications are sovereign — see [`../decisions/0011-applications-are-sovereign.md`](../decisions/0011-applications-are-sovereign.md). A capability owns its own business data, sessions, configuration, APIs, database, and user experience; Merchant Portal owns identity, entitlement, and launch, nothing more, except the one named exception, the Payment Platform ([`../platform/payment-ownership.md`](../platform/payment-ownership.md)).

Merchant Portal's responsibility toward every capability ends at successful launch. It does not enter, redesign, structure, or hold any assumption about what a capability contains internally, and this document does not describe any specific capability's internal contents — that would itself be Merchant Portal reaching into a capability's business. What a capability contains, and how it organizes its own internal boundaries, belongs entirely to that capability's own project.

A capability's own team may find it useful to draw their internal module boundaries by ownership of business data rather than by device, UI, transport, or integration technology — *if I change the catalogue, who should know?* — but that test is theirs to apply to their own product. It is not something Merchant Portal checks, assumes an answer to, or documents on their behalf.

This document, and every other Merchant Portal document, defines Merchant Portal's side of the contract — not the capability behind it. Merchant Portal's documentation may describe:

- entitlement (`CapabilityDefinition`, `MerchantCapability`, `PortalCapabilityAccess`)
- launch eligibility (who may request a launch, and when)
- the signed handover itself (ticket shape, signing, verification)
- the merchant and user context Merchant Portal sends
- session boundaries (Merchant Portal's session ends where the capability's begins)
- return and failure behavior (what happens if launch fails, expires, or is replayed)
- audit evidence (what Merchant Portal records about a launch)

Merchant Portal's documentation must never describe what a capability contains, how it is structured, which of its own features belong together, what data it owns internally, or what screens, modules, or workflows exist after launch. Portal defines the claims it sends — for example a merchant ID, a user ID, a role, a return URL — but not how the capability models or interprets those claims internally. What a capability does with a claim once it has verified the ticket is entirely the capability's own concern.

## What a capability must publish

Every capability exposes, at a stable path, a machine-readable description of itself:

- **Capability identity** — a stable slug (e.g. `move`, `events`, `storefront`) and a human-readable name
- **Contract version** — the version of this contract the capability implements, so Portal can reject an incompatible capability rather than launching into it
- **Launch URL** — where Portal sends a user, with a signed launch ticket, to start a session
- **Health URL** — a simple endpoint Portal can poll to confirm the capability is reachable
- **Public key reference** — how the capability fetches the issuing Merchant Portal deployment's current public key to verify launch tickets (see [`signed-launch-ticket.md`](signed-launch-ticket.md))

See [`capability-starter.md`](capability-starter.md) for the concrete file this lives in (`.well-known/getedge-capability.json`) and the standard scaffold every new capability starts from.

## Registration vs. entitlement vs. access

Three distinct, independent actions — see [`../platform/portal-architecture.md`](../platform/portal-architecture.md) for the full model:

1. **Capability definition** (`CapabilityDefinition`) — a Platform Administrator registers that a capability exists at all. Done once per capability, not per merchant.
2. **Merchant capability entitlement** (`MerchantCapability`) — a Platform Administrator grants a specific merchant access to a registered capability. This is the only per-merchant step, and it is a single toggle, not a workflow.
3. **Portal account access** (`PortalCapabilityAccess`) — a merchant's own Owner/Admin decides which of their own Portal users may launch a capability the merchant is already entitled to.

There is no separate "activation" step, no approval queue, and no capability-specific onboarding wizard. Once a merchant has a `MerchantCapability` row, that capability becomes available to the merchant immediately — no further Platform Administrator action is required. "Available to the merchant" is not the same as "visible to every Portal user at that merchant": the merchant's Owner is auto-granted `PortalCapabilityAccess` at the moment of entitlement (so at least one person at the merchant can always reach it and grant it to others), but any other Portal user at that merchant sees and can launch the capability only once their own Owner/Admin has explicitly granted them `PortalCapabilityAccess` for it. See [`../delivery/release-checklist.md`](../delivery/release-checklist.md) item 4 for the negative case this produces.

## What a capability receives at launch — and what it does not

A capability receives, via the signed launch ticket: which merchant this session is for, which environment (staging/production), who initiated the launch, and a short-lived, single-use grant to start exactly one session. See [`signed-launch-ticket.md`](signed-launch-ticket.md) for the full field list and verification rules.

A capability does **not** receive a Portal or HQ user account to provision, a shared login, or a shared cookie. `initiatedBy` on the ticket is an opaque audit reference to the Merchant Portal principal that requested the launch. For a merchant-user session it references that merchant user; for an HQ-managed session it references the merchant-local HQ-session audit identifier, not the HQ operator as a capability application user. It is never an instruction to create a matching user inside the capability. A capability's own operational identities (a Move device user, an Events staff account) are entirely the capability's own concern and are never derived from, or synced with, Merchant Portal or HQ accounts. See [`../decisions/0004-no-shared-cookies.md`](../decisions/0004-no-shared-cookies.md) and [`../decisions/0008-hq-managed-capability-launch.md`](../decisions/0008-hq-managed-capability-launch.md).

## Capability sessions

Once launched, the capability creates and owns its own session for the duration of the user's work inside it (its own cookie, its own session store). This session is scoped to the capability's own domain/base path and has no validity inside Portal or any other capability. Session lifetime, renewal, and expiry are the capability's own concern, subject only to the constraint that the session cannot outlive what the capability's own security model allows — Portal has no mechanism to revoke a capability session once launched, so a capability must apply its own reasonable expiry.

## Contract tests

Every capability, at minimum, must demonstrably pass the sequence in [`../delivery/release-checklist.md`](../delivery/release-checklist.md): correct merchant context on launch, no second login, rejection of an expired or reused launch ticket, and rejection of any direct (non-Portal-launched) access to its authenticated routes.
