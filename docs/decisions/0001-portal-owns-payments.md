# 0001 — Portal Owns Payments

## Decision

Portal is the only system that ever executes a payment (Hosted Checkout, Virtual Terminal, Pay by Link). Capabilities and integrations store only a reference to a Portal-owned payment and its last-known status; they never hold gateway credentials or execute a charge or refund themselves.

## Why

Payment execution, gateway credentials, and refund authority are the highest-risk part of the system. Concentrating them in one place means there is exactly one thing to secure, audit, and reason about — instead of re-verifying every capability and integration's own payment code independently.

## Alternatives rejected

- **Each capability holds its own NMI credentials and executes payments directly** — rejected because it multiplies the number of places gateway credentials live and the number of codebases that must be independently correct about PCI-relevant handling.
- **Capabilities proxy payment requests through Portal but cache their own copy of authoritative state** — rejected because a cached copy can drift from Portal's own ledger; capabilities store a reference and a status, not a competing source of truth.

## Consequences

Every capability and integration that needs to take payment must call out to Portal rather than build its own payment flow. This is a hard dependency on Portal being reachable at payment time — acceptable, since Portal is the control plane every capability already depends on for launch.
