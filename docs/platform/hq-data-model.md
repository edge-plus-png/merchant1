# HQ Data Model

This is the minimum conceptual model for the HQ boundary. It specifies ownership and invariants, not a database migration or ORM schema.

## HQ-owned records

| Record | Minimum fields | Purpose and invariants |
|---|---|---|
| `HQ` | `id`, `name`, `type` (`EDGE` or `AFFILIATE`), `status` | Organisation using HQ. `EDGE` receives global business visibility; affiliates do not. |
| `HQUser` | `id`, unique normalised username, display name, password hash, encrypted TOTP secret, MFA-enabled timestamp, `status` | Human HQ identity. It is not a Merchant Portal user. Email is not its login identifier. |
| `HQMembership` | `id`, `hqId`, `hqUserId`, `role`, `status`, timestamps | Authorizes an HQ user inside one HQ. Unique active membership per HQ and user. |
| `HQMfaChallenge` | token hash, `hqMembershipId`, failed-attempt count, issued/expiry timestamps | Short-lived state created only after a correct username and password. It grants no HQ access, expires after five minutes, and is consumed before an HQ session is created. |
| `HQSession` | `id`, `hqMembershipId`, issued/expiry/revocation timestamps | Authenticated HQ browser session created only after password and MFA verification. Never valid at a merchant origin. |
| `HQBusinessDirectoryEntry` | `businessId`, display name, slug, exact Merchant Portal origin, status (`PROVISIONING` or `READY`), timestamps | HQ's manually maintained routable projection of a merchant. Only `READY` with an origin can issue a handover. It is not the authoritative merchant record and creates no infrastructure. |
| `HQBusinessAssignment` | `id`, `hqId`, `businessId`, assigned/removed timestamps, actor reference | Makes a business visible to one affiliate HQ. The active HQ/business pair is unique. Edge visibility is a policy override and does not require assignment rows. |
| `HQMerchantStatusAuditEvent` | `businessId`, previous status, new status, `hqId`, `hqUserId`, operator snapshot, timestamp | Append-only evidence for each real `PROVISIONING` ↔ `READY` transition. The status update and audit insert are one transaction. |
| `HQAccessIssuance` | `auditId`, `hqId`, `hqUserId`, `hqMembershipId`, `businessId`, target origin, access mode, ticket nonce/hash, issued/expiry timestamps, outcome | Evidence that HQ authorized and issued a merchant-access ticket. The raw bearer ticket is not retained. |

## Merchant-Portal-owned records

Each merchant stores these records only in its own isolated database.

| Record | Minimum fields | Purpose and invariants |
|---|---|---|
| `HQAccessTicketNonce` | `nonce`, `businessId`, `auditIdentifier`, `expiresAt`, `consumedAt` | Replay protection. Consumption is atomic and unique; one ticket creates at most one session. |
| `HQSupportSession` | `id`, session-token hash, `businessId`, source HQ/operator snapshots, access mode, `auditIdentifier`, issued/expiry timestamps | Distinct merchant-local session type. It has no `PortalUser`, Owner role, or `BusinessMembership`. |
| `HQAccessAuditEvent` | `id`, `auditId`, `hqManagedSessionId`, `businessId`, source HQ/operator snapshots, action, timestamp, outcome, safe metadata | Append-only evidence for exchange, session lifecycle, and material actions. |

Expired `HQSupportSession` records are removed by the scheduled merchant-local
cleanup. Consumed `HQAccessTicketNonce` records are retained for 30 days after
`consumedAt`, then removed. `HQAccessAuditEvent` evidence is not part of this
cleanup.

## References across product boundaries

HQ and Merchant Portal have separate data stores. IDs copied into another product are external references and audit snapshots, not cross-database foreign keys. The shared `businessId` and `auditId` correlate evidence; neither creates shared ownership. HQ operator snapshots use the HQ username, not a merchant identity or email login.

The Merchant Portal's authoritative `Business` record is not moved into HQ. The HQ directory stores only the minimum projection needed to authorize selection and route the browser to the exact merchant origin.

## Forbidden relationships

- No `BusinessMembership` is created for an HQ operator.
- No `PortalCapabilityAccess` is created for an HQ operator.
- No merchant Owner or Admin role is assigned to an HQ operator.
- No HQ user record is provisioned as a capability application user.
- No HQ session or cookie is accepted by Merchant Portal or a capability.
- No merchant user record is treated as an `HQUser` or `HQMembership`.
- No capability launch nonce or session is reused as an HQ merchant-access nonce or session.
