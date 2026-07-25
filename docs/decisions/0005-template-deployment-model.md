# 0005 — Template Deployment Model

## Decision

`template.getedgeportal.app` (Vercel project `portalapp-template`, branch `main`/`release`) is a certified release candidate, not a merchant. New merchants are created from its current certified state; existing merchants are updated to a certified Template state individually and manually. No merchant is ever pointed at `template-staging`, and promoting staging into Template never itself changes what any existing merchant sees.

## Why

This directly addresses a real incident from the previous architecture: a generic Vercel preview domain was mistaken for the real staging environment, and separately, ambiguity over which of two near-identically-named repos actually served a production domain caused a false "data has been deleted" scare. Both problems stemmed from domains, branches, and "what this environment is for" not being pinned down as fixed, named, singular concepts. Fixing Template as a specific, singular, well-known non-merchant baseline — and making merchant creation/update explicit, manual, one-at-a-time actions — removes the ambiguity that caused both incidents.

## Alternatives rejected

- **Merchants track Template's branch directly and redeploy automatically on every Template change** — rejected: this is the "fleet update" pattern explicitly ruled out; one bad Template promotion would silently break every merchant simultaneously, with no ability to catch it on one merchant before it reaches the rest.
- **No separate Template stage — staging promotes directly to being "the" merchant baseline** — rejected: this removes the one stable, low-risk point on which to run the full release checklist before anything merchant-facing depends on the result.

## Consequences

Merchant creation and merchant update are two distinct, deliberate operations that must each be run and verified per merchant (see [`../platform/merchant-deployment-model.md`](../platform/merchant-deployment-model.md), [`../delivery/template-to-merchant.md`](../delivery/template-to-merchant.md)). Domains are never moved as a first step — a replacement project is verified on its own temporary URL before any custom domain is deliberately repointed to it (see [`../platform/deployment-and-vercel-model.md`](../platform/deployment-and-vercel-model.md)).
