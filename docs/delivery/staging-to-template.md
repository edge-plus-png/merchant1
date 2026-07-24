# Staging → Template Promotion

## What is being promoted

Portal's own codebase, from `portalapp-staging` (branch `staging`, `template-staging.getedgeportal.app`) to `portalapp-template` (branch `main`/`release`, `template.getedgeportal.app`). This promotion changes nothing for any existing merchant — Template is not a merchant, and no merchant is pointed at Template's branch. See [`../platform/deployment-and-vercel-model.md`](../platform/deployment-and-vercel-model.md).

## Gate

Promotion from staging to Template happens only after the current staging build passes the full [`release-checklist.md`](release-checklist.md) — the capability launch sequence (correct merchant context, no second login, ticket rejection cases) plus the merchant-deployment-model proof. This proof runs against the **release candidate commit** (the current tip of `staging`), before it is promoted — the release checklist is what qualifies a commit to become certified, not something re-run against Template after the fact.

## Verification deployments are not merchants

The merchant-deployment proof does not use a real customer merchant — including Edge's own portal — and does not point any merchant at `template-staging`, both of which remain absolutely ruled out by [`../platform/merchant-deployment-model.md`](../platform/merchant-deployment-model.md). Instead, two dedicated **verification projects** exist solely to prove the mechanism, and are never used by any real user, Platform Administrator or merchant:

- **`portalapp-verify-create`** — a disposable Vercel project and database, torn down and recreated fresh from the release candidate commit for every promotion attempt. Proves the creation mechanism. Discarded after each check regardless of outcome.
- **`portalapp-verify-update`** — a persistent Vercel project and database, created once (from the first certified Template release) and never deleted. Every promotion attempt updates it to the release candidate commit, proving the update mechanism. Because this project is explicitly a verification tool and not a merchant, it is exempt from the rule that merchant updates must come from an already-certified commit — proving the update mechanism against the *candidate* commit is the entire point of running it before certification.

Neither project is a merchant, so neither is bound by the "one merchant, one schedule, only from certified commits" rules in [`../platform/merchant-deployment-model.md`](../platform/merchant-deployment-model.md) — those rules govern real merchants only. Edge's own portal (`edge.getedgeportal.app`) is a real merchant like any other (see [`../platform/deployment-and-vercel-model.md`](../platform/deployment-and-vercel-model.md), "Merchant projects") and is created and updated exactly as [`template-to-merchant.md`](template-to-merchant.md) describes, on its own schedule, only ever from certified Template releases — it plays no role in this gate. See [`../delivery/release-checklist.md`](../delivery/release-checklist.md) items 12–13 for the exact checks.

## What "certified" means

A specific `staging` commit becomes the certified Template state at the moment it is merged/promoted into `main`/`release` after passing the gate above. That commit is recorded by tagging the release (e.g. `template-vYYYY-MM-DD` or an equivalent release tag) at the point of promotion. "Certified" always refers to one specific tagged commit, not "whatever `main` currently contains" — this is what a merchant creation or update in [`template-to-merchant.md`](template-to-merchant.md) is deployed from.

## Process

1. Confirm the candidate `staging` commit is green against the release checklist, including the merchant-deployment proof run against that candidate commit.
2. Merge/promote that commit from `staging` into `main`/`release`, and tag it as the new certified Template release.
3. `portalapp-template` deploys automatically from that branch (this is the one auto-deploy step in the pipeline — Template redeploying from its own branch is expected and safe, since Template is not a merchant and nothing depends on it not changing).
4. The newly tagged commit is now the certified baseline for any future merchant creation or merchant update. It is not pushed to any existing merchant automatically — see [`template-to-merchant.md`](template-to-merchant.md).

## What this is not

This is not a release to real merchants. Nobody's real business is affected by a Template promotion. Only the "what would a new merchant get today" answer changes.
