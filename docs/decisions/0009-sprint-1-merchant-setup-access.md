# 0009 — Edge Merchant Setup Access

## Decision

An authenticated Edge HQ operator receives a ticket with
`EDGE_FULL_ACCESS`. The Merchant Portal converts it into a distinct, temporary
session-level `EDGE` role with full read/write access to business information,
users, and application management. The role never creates or grants a
`PortalUser`, `BusinessMembership`, or Owner membership to the operator.

Affiliate tickets remain `SUPPORT_READ_ONLY`.

## Why

Edge product operators must be able to set up a merchant before its first owner
accepts an invitation. Session-level authority preserves the product boundary
without inventing a merchant identity for Edge.

## Consequences

The Merchant Portal presents an Edge session like normal authorized use: no
banner, HQ-access label, audit identifier, or other access-mode indicator is
shown. Only the opaque session and consumed ticket nonce are retained as needed
to authenticate the session and prevent ticket replay.

Merchant Portal does not create an access audit event for `EDGE_FULL_ACCESS` and
does not log or display individual Edge actions. The authoritative audit evidence
is HQ's ticket-issuance record. Normal business, membership, invitation, and app
records still change when Edge performs the corresponding authorized write; those
records contain no Edge action attribution.
