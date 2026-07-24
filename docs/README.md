# GetEdgePortal — Architecture Reset

This folder is the authoritative source for the rebuilt GetEdgePortal platform ("Portal v2"). It is a clean rebuild, not a migration of the existing GetEdgePortal codebase. Nothing here inherits the old Contract 2.0 pairing lifecycle, the old App Installer wizard, or the old repo/domain sprawl.

## Status

Architecture documentation. Read [`platform/portal-architecture.md`](platform/portal-architecture.md) first. HQ, Merchant Portal, and Capabilities are separate products with separate identity and session boundaries.

## Why this exists

The previous architecture accumulated: a per-merchant registration → approval → activation pairing ceremony duplicated across Move, Events, and Storefront; ambiguous repo/domain ownership across near-duplicate Vercel projects; a shared-secret launch mechanism unique to Events; and an App Installer that conflated "does this feature exist at all" with "can this specific merchant use it." Portal v2 replaces all of that with three fixed concepts and one launch mechanism, used identically everywhere.

## The three environments

- **template-staging** (`template-staging.getedgeportal.app`, branch `staging`, Vercel project `portalapp-staging`) — where new work is built and tested. Never a merchant.
- **template** (`template.getedgeportal.app`, branch `main`/`release`, Vercel project `portalapp-template`) — the certified release candidate. Not a merchant portal. This is the baseline every real merchant is created from or updated to.
- **merchant** (e.g. `edge.getedgeportal.app`, `littleadventureland.getedgeportal.app`) — one Vercel project and one database per merchant. Each merchant is a separate deployment, created from Template's current certified state, and updated deliberately, one at a time, never automatically.

Promotion is one-directional and manual: staging → template → merchant. Nothing is promoted automatically at any stage. See [`delivery/staging-to-template.md`](delivery/staging-to-template.md) and [`delivery/template-to-merchant.md`](delivery/template-to-merchant.md).

HQ follows its own staging → production promotion path using separate
`portalapp-hq-staging` and `portalapp-hq` projects, databases, and signing keys. See
[`decisions/0010-hq-staging-and-production.md`](decisions/0010-hq-staging-and-production.md).

## Reading order

1. [`platform/portal-architecture.md`](platform/portal-architecture.md) — the three products and their ownership boundaries
2. [`platform/hq-architecture.md`](platform/hq-architecture.md) — HQ visibility, merchant entry, session, audit, and capability hand-off
3. [`platform/hq-data-model.md`](platform/hq-data-model.md) — the minimum conceptual records and where they live
4. [`platform/deployment-and-vercel-model.md`](platform/deployment-and-vercel-model.md) — every Vercel project, branch, and domain and what it's for
5. [`platform/merchant-deployment-model.md`](platform/merchant-deployment-model.md) — how a merchant is created and updated
6. [`platform/payment-ownership.md`](platform/payment-ownership.md) — who executes payments, who owns refunds
7. [`capabilities/capability-contract.md`](capabilities/capability-contract.md) — what every capability must implement
8. [`capabilities/signed-launch-ticket.md`](capabilities/signed-launch-ticket.md) — the one Merchant Portal-to-capability SSO mechanism
9. [`capabilities/capability-starter.md`](capabilities/capability-starter.md) — the scaffold a new capability starts from
10. [`integrations/integration-contract.md`](integrations/integration-contract.md) — how integrations differ from capabilities
11. [`integrations/integration-starter.md`](integrations/integration-starter.md) — the scaffold a new integration starts from
12. [`delivery/staging-to-template.md`](delivery/staging-to-template.md), [`delivery/template-to-merchant.md`](delivery/template-to-merchant.md), [`delivery/release-checklist.md`](delivery/release-checklist.md) — the promotion process and its proof
13. [`decisions/`](decisions/) — why the above is shaped this way, and what was rejected

## Documentation QA

Before any code is written, this documentation is tested, not assumed correct. An independent reviewer — with no context beyond these files — is given only this `docs/` folder and asked comprehension questions such as: how does a new capability start; how is a merchant created; where does Hosted Checkout live; who owns refunds; can a Portal user become a Move device user; what is the purpose of Template; how does a merchant receive an update; how do capabilities authenticate launches; how do integrations differ from capabilities.

If the reviewer's answers are inconsistent, contradictory, or unanswerable from the docs alone, the documentation has failed — not the reviewer. The docs are fixed and the review repeats until every answer is consistent. Only then is the architecture frozen and coding begins. Every round of this review, its findings, and the fixes applied are recorded in [`qa-log.md`](qa-log.md).
