# Deployment and Vercel Model

Every project, branch, and domain below has exactly one job. Nothing is shared across jobs. This list is the single source of truth for what exists and what each thing is for — if a Vercel project isn't described here, it isn't part of Portal v2.

## Portal projects

| Vercel project | Branch | Domain | Purpose |
|---|---|---|---|
| `portalapp-staging` | `staging` | `template-staging.getedgeportal.app` | Where new Portal work is built and tested. Never treated as a merchant. Freely broken and fixed. |
| `portalapp-template` | `main` / `release` | `template.getedgeportal.app` | The certified release candidate. Not a merchant portal — nobody's real business runs on it. Every real merchant is created from, or updated to, this project's current state. |

## Merchant projects

One Vercel project, one database, one domain, per merchant. For example:

- `edge.getedgeportal.app` — Edge's own portal, using Portal exactly as any merchant would
- `littleadventureland.getedgeportal.app`
- `lyonandturnbull.getedgeportal.app`

Merchants do not share a database, a Vercel project, or a deployment with each other or with Template. Each merchant's own Merchant Portal deployment holds its own `MerchantApplication`, `PortalCapabilityAccess`, and launch-ticket signing key directly. See [`portal-architecture.md`](portal-architecture.md) and [`merchant-deployment-model.md`](merchant-deployment-model.md).

## HQ projects

HQ is a separate product and deployment, not a route area inside Merchant Portal.
Its staging and production environments have separate projects, databases, signing
keys, identities, sessions, directory data, replay state, and audit evidence. See
[`../decisions/0007-hq-merchant-access.md`](../decisions/0007-hq-merchant-access.md)
and
[`../decisions/0010-hq-staging-and-production.md`](../decisions/0010-hq-staging-and-production.md).

Each HQ project also has its own `HQ_MFA_ENCRYPTION_KEY`. It encrypts HQ TOTP
secrets and is never reused as the merchant-access signing key or shared between
staging and production.

| Vercel project | Branch | Domain | Purpose |
|---|---|---|---|
| `portalapp-hq-staging` | `staging` | Temporary Vercel URL first; then `hq-staging.getedgeportal.app` | HQ development and end-to-end verification using staging-only data and keys |
| `portalapp-hq` | `main` / release | `hq.getedgeportal.app` | Production HQ authentication, merchant directory, merchant-access ticket issuance, and HQ-side audit |

## Capability projects

Each capability (Move, Events, Storefront) gets its own pair of Vercel projects, matching Portal's staging/template split, but capabilities do not have a "per-merchant deployment" the way Portal does — one running capability instance serves all merchants entitled to it, distinguishing merchants at launch time via the signed launch ticket, not via separate deployments.

| Capability | Staging project | Staging domain | Production project | Production domain |
|---|---|---|---|---|
| Move | `move-staging` | `move-staging.getedgeportal.app` | `move-production` | `move.getedgeportal.app` |
| Events | `events-staging` | `events-staging.getedgeportal.app` | `events-production` | `events.getedgeportal.app` |
| Storefront | `storefront-staging` | `storefront-staging.getedgeportal.app` | `storefront-production` | `storefront.getedgeportal.app` |

Each capability domain remains the independently deployed upstream. A merchant's
browser-visible application routes are served through a unique Portal-owned zone
such as `/apps/move`, using a secure external rewrite to that upstream. This keeps
the user on the merchant domain while preserving independent deployments,
databases, sessions, and release histories. The Portal-to-capability rewrite also
authenticates its browser-visible origin assertion with a shared, server-only proxy
secret because the rewrite replaces ordinary forwarded-host headers.

## Verification projects

Two Vercel projects exist solely to prove the merchant-creation and merchant-update mechanisms as part of the promotion gate. Neither is a merchant, neither has a real domain, and neither is ever used by a real Edge or merchant user — see [`../delivery/staging-to-template.md`](../delivery/staging-to-template.md) ("Verification deployments are not merchants") and [`merchant-deployment-model.md`](merchant-deployment-model.md).

| Vercel project | Lifecycle | Purpose |
|---|---|---|
| `portalapp-verify-create` | Torn down and recreated on every promotion attempt | Proves the merchant-creation mechanism |
| `portalapp-verify-update` | Created once, persists indefinitely, updated on every promotion attempt | Proves the merchant-update mechanism |

## Rule: never move a domain before the replacement is verified

Do not repoint a production domain to a new project as a first step. Build and verify the new project on its own temporary Vercel-issued URL (`*.vercel.app`) first — confirm the build is green, confirm the functionality being replaced actually works end to end — and only then deliberately move the custom domain across. This is a direct lesson from a real incident: a domain-ownership mix-up between two near-identically-named repos caused a false "data has been deleted" scare, because a generic Vercel preview domain (`template-preview.getedgeportal.app`, which serves whichever unassigned branch happens to be most recent) was mistaken for the real staging domain. Portal v2's projects and domains are deliberately named and scoped to make this class of mistake harder to make twice.

## Old projects: rename, don't delete

The projects being replaced are renamed to make their status obvious, not deleted:

- `legacy-template-portal`
- `legacy-move-control-plane`
- `legacy-events`
- `legacy-storefront`

They are kept as reference until their Portal v2 replacements are verified and have taken over the relevant production domains. Production domains are removed from the legacy projects only once the new project is confirmed ready to receive them — not before.
