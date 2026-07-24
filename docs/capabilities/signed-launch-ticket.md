# Signed Launch Ticket

This is the single SSO mechanism used by every first-party capability — Move, Events, Storefront, and any future capability. It replaces Events' existing shared-secret launch approach entirely; no capability keeps its own bespoke launch scheme. See [`../decisions/0003-signed-launch-ticket.md`](../decisions/0003-signed-launch-ticket.md).

## Mechanism

Asymmetric signing, held centrally. The signing private key lives in the Platform Registry (see [`../platform/portal-architecture.md`](../platform/portal-architecture.md), "Where platform data lives") — one key per environment tier, not one per merchant deployment. No individual merchant's Portal deployment holds or has access to the private key itself. When a Portal user clicks launch, that merchant's own Portal deployment calls its tier's Registry (`portalapp-registry-staging` or `portalapp-registry-production`) as an internal signing service, supplying the merchant, capability, and initiating user; the Registry signs and returns the ticket. Capabilities never hold the private key either — they fetch the Registry's current public key (via the reference published in the capability's own `.well-known/getedge-capability.json`, see [`capability-starter.md`](capability-starter.md)) and use it only to verify signatures. A capability that can verify a ticket cannot forge one.

## Ticket shape

| Field | Meaning |
|---|---|
| `issuer` | Fixed identifier for the signing Registry for this tier (e.g. `portalapp-registry-production`) — not the individual merchant deployment that requested the ticket, since signing is centralized, not per-deployment |
| `audience` | The capability slug this ticket is valid for (e.g. `move`) — a ticket issued for one capability must be rejected by any other |
| `merchantId` | The merchant this session is for |
| `merchantName` | Display name, for the capability's own UI — not authoritative, the capability should treat `merchantId` as the source of truth |
| `environment` | `staging` or `production` — a ticket issued for one must be rejected by a capability instance running in the other |
| `initiatedBy` | Which Portal user clicked launch, for audit logging only |
| `expiresAt` | Absolute expiry, short-lived (on the order of seconds, not minutes) |
| `nonce` | Single-use identifier |

## Verification

A capability must reject a launch ticket unless all of the following hold:

- signature verifies against the issuing Registry's current public key
- `audience` matches this capability's own slug
- `environment` matches which environment this capability instance is running in
- `expiresAt` has not passed
- `nonce` has not been seen before (replay protection — the capability must track consumed nonces for at least the ticket's maximum lifetime)

A ticket that fails any check is rejected outright. There is no partial trust and no fallback authentication path.

## What a ticket does not do

- It does not provision a user inside the capability. `initiatedBy` is an audit field, not a create-user instruction.
- It does not establish a shared cookie or shared session with Portal. Once the capability accepts the ticket, it creates its own session, entirely separate from Portal's. See [`../decisions/0004-no-shared-cookies.md`](../decisions/0004-no-shared-cookies.md).
- It is not reusable. One ticket authorizes the creation of exactly one capability session. A second launch, even seconds later, requires a fresh ticket.

## Public key discovery

The Registry for each tier publishes its current public key at a stable, versioned endpoint — not each individual merchant Portal deployment, since the key is shared per tier, not per merchant. Capabilities cache it but must be able to pick up a rotated key without a code change or redeploy — key rotation is an operational event, not a release.
