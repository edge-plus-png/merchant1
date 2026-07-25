# 0007 — HQ Merchant Access Is a Separate Managed Session

## Decision

GetEdgePortal has three products. This decision concerns the boundary between two of them:

- **HQ** — planned domain `hq.getedgeportal.app`, temporarily deployed only
  to a Vercel-issued URL while the proof is being verified. Edge and affiliate HQ
  operators use HQ identities and see the merchants they are authorised to manage.
- **Merchant Portal** — one deployment and domain per merchant, as already defined
  by the merchant deployment model. Merchant users operate only their own business.

The third product, **Capabilities**, remains outside the HQ identity plane and is
launched only by Merchant Portal using merchant context.

An HQ operator can select an authorised merchant in HQ and enter that merchant's
own Portal without a merchant user's credentials. This creates a distinct,
merchant-local **HQ-managed session**. It is not impersonation and does not create a
`PortalUser`, `BusinessMembership`, or merchant Owner identity for the operator.

## Access mechanism

HQ issues a short-lived, asymmetrically signed, single-use merchant-access ticket.
This ticket is separate from capability launch tickets and has a distinct type,
audience, key, endpoint, session, nonce store, and audit trail.

The ticket records the target business and Portal origin, originating HQ, HQ
operator, access mode, issued time, expiry, nonce, and audit identifier. The
merchant Portal verifies the signature, issuer, ticket type, audience, target
business, target origin, issued time, expiry, and nonce, then consumes the nonce
atomically into `HQAccessTicketNonce` before creating its own opaque
`HQSupportSession`.

HQ authentication, merchant-user authentication, and merchant-local HQ-managed
access each use a different cookie. Cookies are host-only and are never shared
between HQ and merchant domains.

## Visibility and authorization

- Edge HQ may select every business in the HQ directory.
- An affiliate HQ may select only businesses explicitly assigned to that HQ through
  `HQBusinessAssignment`.
- Merchant users remain scoped to their own merchant deployment.
- HQ-managed sessions are explicitly typed as HQ access, never as a merchant role.
  Their permitted actions are derived from the recorded access mode.
- A request with an active merchant-user session is not allowed to exchange an HQ
  access ticket.
- HQ pages and APIs exist only in the HQ product. Merchant Portals contain no HQ
  routes and no business selector. Merchant users cannot issue or exchange HQ tickets.

## Audit

HQ records ticket issuance before the ticket leaves the HQ surface. The merchant
records successful nonce consumption, HQ-managed session creation, and actions
performed through that session. Both records use the same audit identifier and
snapshot the HQ, operator, target business, access
mode, issued time, and expiry so evidence does not depend on provisioning the HQ
operator into the merchant database.

## Consequences

HQ is a separate product and needs its own data store for HQ identities,
memberships, sessions, the cross-merchant business directory and assignments, and
issuance audit. Every merchant keeps HQ-managed sessions, consumed nonces, and
merchant-side audit events in its own isolated database. The HQ signing private key exists only on HQ;
merchant deployments receive only its public verification key.

Expired `HQSupportSession` rows are operational state and are deleted by a
scheduled cleanup. Consumed `HQAccessTicketNonce` rows remain as replay/audit
evidence for 30 days after `consumedAt`; merchant-side audit events are retained
separately and are not deleted by this cleanup.

Entering a merchant does not automatically authorize any merchant action.
Merchant Portal evaluates the HQ-managed session's access mode for every request.
Sprint 1 stops at read-only Merchant Portal entry, as defined in
[`0009-sprint-1-merchant-setup-access.md`](0009-sprint-1-merchant-setup-access.md).
When capability launch is permitted, Merchant Portal creates the existing
merchant-context capability launch ticket; no HQ merchant-access ticket, HQ cookie,
or HQ application-user identity is forwarded to the capability. See
[`0008-hq-managed-capability-launch.md`](0008-hq-managed-capability-launch.md).

The planned custom HQ domain is not attached as part of this proof. The flow must
pass locally and on temporary Vercel URLs first.
