# Capability Contract

This replaces Contract 2.0's per-merchant pairing lifecycle (registration → approval → activation). There is no pairing state machine in Portal v2. A capability's relationship to Portal is defined once, globally; a merchant's access to it is a single on/off grant.

## What a capability must publish

Every capability exposes, at a stable path, a machine-readable description of itself:

- **Capability identity** — a stable slug (e.g. `move`, `events`, `storefront`) and a human-readable name
- **Contract version** — the version of this contract the capability implements, so Portal can reject an incompatible capability rather than launching into it
- **Launch URL** — where Portal sends a user, with a signed launch ticket, to start a session
- **Health URL** — a simple endpoint Portal can poll to confirm the capability is reachable
- **Registry public key reference** — how the capability fetches its tier's Platform Registry's current public key to verify launch tickets (see [`signed-launch-ticket.md`](signed-launch-ticket.md))

See [`capability-starter.md`](capability-starter.md) for the concrete file this lives in (`.well-known/getedge-capability.json`) and the standard scaffold every new capability starts from.

## Registration vs. entitlement vs. access

Three distinct, independent actions — see [`../platform/portal-architecture.md`](../platform/portal-architecture.md) for the full model:

1. **Capability definition** (`CapabilityDefinition`) — a Platform Administrator registers that a capability exists at all. Done once per capability, not per merchant.
2. **Merchant capability entitlement** (`MerchantCapability`) — a Platform Administrator grants a specific merchant access to a registered capability. This is the only per-merchant step, and it is a single toggle, not a workflow.
3. **Portal account access** (`PortalCapabilityAccess`) — a merchant's own Owner/Admin decides which of their own Portal users may launch a capability the merchant is already entitled to.

There is no separate "activation" step, no approval queue, and no capability-specific onboarding wizard. Once a merchant has a `MerchantCapability` row, that capability becomes available to the merchant immediately — no further Platform Administrator action is required. "Available to the merchant" is not the same as "visible to every Portal user at that merchant": the merchant's Owner is auto-granted `PortalCapabilityAccess` at the moment of entitlement (so at least one person at the merchant can always reach it and grant it to others), but any other Portal user at that merchant sees and can launch the capability only once their own Owner/Admin has explicitly granted them `PortalCapabilityAccess` for it. See [`../delivery/release-checklist.md`](../delivery/release-checklist.md) item 4 for the negative case this produces.

## What a capability receives at launch — and what it does not

A capability receives, via the signed launch ticket: which merchant this session is for, which environment (staging/production), who initiated the launch, and a short-lived, single-use grant to start exactly one session. See [`signed-launch-ticket.md`](signed-launch-ticket.md) for the full field list and verification rules.

A capability does **not** receive a Portal user account to provision, a shared login, or a shared cookie. `initiatedBy` on the ticket identifies who clicked launch, for audit purposes only — it is not an instruction to create a matching user inside the capability. A capability's own operational identities (a Move device user, an Events staff account) are entirely the capability's own concern and are never derived from, or synced with, Portal user accounts. A Portal user cannot "become" a Move device user by any Portal-side action; if a capability needs its own users, it manages them itself, inside its own launched session. See [`../decisions/0004-no-shared-cookies.md`](../decisions/0004-no-shared-cookies.md).

## Capability sessions

Once launched, the capability creates and owns its own session for the duration of the user's work inside it (its own cookie, its own session store). This session is scoped to the capability's own domain/base path and has no validity inside Portal or any other capability. Session lifetime, renewal, and expiry are the capability's own concern, subject only to the constraint that the session cannot outlive what the capability's own security model allows — Portal has no mechanism to revoke a capability session once launched, so a capability must apply its own reasonable expiry.

## Contract tests

Every capability, at minimum, must demonstrably pass the sequence in [`../delivery/release-checklist.md`](../delivery/release-checklist.md): correct merchant context on launch, no second login, rejection of an expired or reused launch ticket, and rejection of any direct (non-Portal-launched) access to its authenticated routes.
