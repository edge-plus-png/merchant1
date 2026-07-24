# Merchant Deployment Model

## Creating a new merchant

A new merchant is created by deploying a fresh copy of the **current certified Template** (`portalapp-template`, `template.getedgeportal.app` at its current commit) into a new, dedicated Vercel project with its own database. It is not created by branching from `template-staging`, and not created by copying another merchant's deployment. The new merchant starts at whatever release Template happened to certify most recently — it does not automatically receive Template updates made after its creation.

## Updating an existing merchant

Updating a merchant means deliberately deploying that merchant's project from a specific certified Template commit — never automatic, never triggered by a Template promotion, and never applied to more than one merchant in the same action. Each merchant is updated individually, on its own schedule, so that a problem discovered on one merchant's update does not force the same problem onto every other merchant.

Template being promoted (see [`../delivery/staging-to-template.md`](../delivery/staging-to-template.md)) does not, by itself, change anything a merchant sees. A merchant only changes when someone explicitly runs that merchant's own update.

## What this rules out

- No merchant is ever pointed directly at `template-staging`.
- No merchant deployment shares its own business data (users, sessions, business records) with another merchant's deployment or database. This isolation is scoped to merchant data specifically — it does not mean a merchant is cut off from the cross-merchant Platform Registry (capability entitlements, the Platform Organisation); see [`portal-architecture.md`](portal-architecture.md), "Where platform data lives."
- No "fleet update" mechanism pushes a Template change to all merchants at once. If that capability is wanted later, it is a deliberate, visible, one-at-a-time rollout tool built on top of this model — not a default behavior of it.

## Proof this works (see also `../delivery/release-checklist.md`)

The mechanism above is proven as part of the promotion gate, before a candidate commit is certified — not afterward, and not using any real merchant, Edge's own portal included (see [`../delivery/staging-to-template.md`](../delivery/staging-to-template.md), "Verification deployments are not merchants"):

1. `portalapp-verify-create`, a disposable verification project torn down and rebuilt each run, is created fresh from the release candidate and works end to end — proving the creation mechanism, without being a real merchant.
2. `portalapp-verify-update`, a persistent verification project that exists solely for this purpose, is updated to the release candidate, individually, without affecting any real merchant. This proves the update mechanism. Because this project is not a merchant, it is exempt from the "only from certified commits" rule above — proving the update works against the not-yet-certified candidate is the reason it runs before certification.

Once a commit passes both checks and is certified, the same two actions — create, update — are what a real merchant creation or update uses in production, per [`../delivery/template-to-merchant.md`](../delivery/template-to-merchant.md). Edge's own portal is a real merchant like any other and follows that path on its own schedule; it has no special role in the promotion gate.
