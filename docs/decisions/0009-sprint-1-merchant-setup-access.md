# 0009 — Sprint 1 Stops After Merchant Portal Entry

## Decision

Sprint 1 ends when an Edge HQ operator opens a merchant's own Portal and the
Merchant Portal establishes a distinct HQ-managed session. The session uses the
existing `SUPPORT_READ_ONLY` access mode and displays its HQ origin and audit
identifier.

Sprint 1 does not grant any merchant write action. It does not create a merchant
Owner, `PortalUser`, `BusinessMembership`, password, activation, capability access,
payment access, or integration access.

## Why

The first delivery milestone proves the product and identity boundary before any
merchant administration is added. The operator remains an HQ identity and the
Merchant Portal can independently verify, record, and display that context.

## Consequences

The only Merchant Portal route required by the Sprint 1 handover is `/dashboard`.
HQ creates only a manual directory record with `PROVISIONING` or `READY` status;
the handover is available only to a `READY` record with a Portal URL. Directory
creation performs no infrastructure provisioning.
Business setup, merchant users, activation, capabilities, payments, applications,
and integrations require separate future authorization decisions and are not part
of this milestone.
