# Documentation QA Log

Each round: an independent reviewer with no prior context reads only `docs/` and answers a fixed set of comprehension questions. Any inconsistency found is a documentation failure, fixed before the next round. See [`README.md`](README.md) ("Documentation QA") for the methodology.

## Round 1 — 2026-07-23

**Reviewer:** fresh general-purpose agent, given only the `docs/` folder path and the nine questions below, no other context.

**Questions asked:** how does a new capability start; how is a merchant created; where does Hosted Checkout live; who owns refunds; can a Portal user become a Move device user; what is the purpose of Template; how does a merchant receive an update; how do capabilities authenticate launches; how do integrations differ from capabilities.

**Result:** all nine questions were answered correctly and consistently, each citing the correct source file. Four issues were found and fixed before this round closed:

1. **Apps-screen visibility contradiction** — `capabilities/capability-contract.md` said a capability "appears on their Apps screen immediately" once a merchant holds a `MerchantCapability` grant, which read as merchant-wide visibility; `delivery/release-checklist.md` (item 4) required that a Portal user without `PortalCapabilityAccess` cannot see or launch it even though their merchant is entitled. Fixed by making explicit that entitlement makes a capability *available to the merchant*, the merchant's Owner is auto-granted `PortalCapabilityAccess` at that moment, and every other Portal user needs it granted explicitly. Updated in `capabilities/capability-contract.md` and `platform/portal-architecture.md`.
2. **"Certified" Template state undefined** — the process for reaching a certified state was documented, but no artifact marked a commit as certified. Fixed by defining certification as a release tag applied to a specific `staging` commit at the moment of promotion. Updated in `delivery/staging-to-template.md`.
3. **Ordering ambiguity in the promotion gate** — unclear whether the merchant-deployment proof (new merchant creation, existing merchant update) ran against the pre-promotion candidate or was re-run against Template afterward. Fixed by stating the proof runs against the candidate `staging` commit before promotion. Updated in `delivery/staging-to-template.md`.
4. **Multi Zones vs. dedicated domain contradiction** — `capabilities/capability-starter.md` described a capability as possibly served under Portal's own domain via a base-path rewrite ("Multi Zones"), which conflicts with `platform/deployment-and-vercel-model.md`'s model of each capability living at its own dedicated Vercel project and domain. Resolved in favor of the dedicated-domain model (matching the "independently deployed" premise the whole architecture rests on); the Multi Zones/base-path language was a holdover from the previous architecture and has been removed. Updated in `capabilities/capability-starter.md`.

Also fixed: `README.md` referenced a per-doc "Open questions" section and a "QA log" that didn't exist yet — only one doc had such a section. Replaced with a direct pointer to this file.

**Outcome:** round 1 closed with four fixes applied. A second round should be run against the corrected docs before the architecture is considered frozen.

## Round 2 — 2026-07-23

**Reviewer:** fresh general-purpose agent, no memory of round 1's findings, given only the `docs/` folder and asked to independently verify the four round-1 fixes plus re-answer all nine comprehension questions.

**Result:** all nine comprehension questions still answered correctly and consistently. Three of the four round-1 fixes verified clean (Apps-screen visibility, certified-Template artifact, dedicated-domain vs. base-path). One round-1 fix — the promotion-gate ordering clarification — introduced a **new contradiction**: the fixed wording in `delivery/staging-to-template.md` said the merchant-deployment proof runs against "a merchant deployed from the candidate `staging` commit," which collided directly with the absolute rule in `platform/merchant-deployment-model.md` and `decisions/0005-template-deployment-model.md` that no merchant is ever pointed at `template-staging`. The docs had no concept of a disposable/reference deployment distinct from a real merchant to reconcile this.

Fixed by introducing that concept explicitly, consistently, in three places:

- `delivery/staging-to-template.md` — new "Verification deployments are not merchants" section: the creation check uses a disposable, throwaway project (discarded after passing); the update check uses Edge's own portal (`edge.getedgeportal.app`), a standing Platform-operated deployment, not a customer merchant.
- `delivery/release-checklist.md` items 12–13 — rewritten to name these two verification deployments explicitly instead of generically saying "a brand-new merchant" / "an existing merchant."
- `platform/merchant-deployment-model.md` "Proof this works" — rewritten to match, and to state explicitly that the proof runs before certification, not after.

Also fixed two lesser gaps the same round surfaced: capability domains were asserted ("its own dedicated domain") but never given concrete values anywhere — added an explicit domain column to the capability table in `platform/deployment-and-vercel-model.md` (`move.getedgeportal.app`, `events.getedgeportal.app`, `storefront.getedgeportal.app`, plus staging equivalents). And a dangling "Lite-role" example in `delivery/release-checklist.md` item 4 (a role name used nowhere else in the corpus) was replaced with a direct pointer to the actual `PortalCapabilityAccess` rule in `platform/portal-architecture.md`.

**Outcome:** round 2 closed with four fixes applied (one correcting a defect introduced by round 1's own fix). A third round should be run to confirm the ordering fix didn't introduce a further regression before the architecture is considered frozen.

## Round 3 — 2026-07-23

**Reviewer:** fresh general-purpose agent, focused specifically on verifying round 2's merchant-vs-verification-deployment fix, plus a light re-check of three affected comprehension questions.

**Result:** the reviewer found round 2's fix was not fully consistent. Using Edge's own live portal (`edge.getedgeportal.app`) as the update-verification target created two real problems, neither acknowledged in round 2's text: (1) `platform/deployment-and-vercel-model.md` still listed Edge's portal under "Merchant projects," identical in kind to real customer merchants, with no cross-reference to a special verification role — an un-synced source of truth; (2) Edge's portal being updated to an *uncertified* release-candidate commit, before promotion, directly conflicted with `merchant-deployment-model.md`'s own rule that merchant updates come only from certified commits — meaning Edge's real, in-use admin portal would by construction always run ahead of every actual merchant on unproven code, with no rollback plan if the gate check failed.

**Root cause:** conflating a real, live, in-use deployment (Edge's portal) with a disposable test fixture. Fixed by removing Edge's portal from this role entirely and introducing two dedicated, purpose-built, non-merchant verification projects instead:

- `portalapp-verify-create` — disposable, torn down and rebuilt every promotion attempt, proves creation.
- `portalapp-verify-update` — persistent but never a merchant, created once and updated every promotion attempt, proves the update mechanism. Explicitly exempted from the "certified commits only" rule, since proving the update against the *not-yet-certified* candidate is the entire point of running the check before certification — this exemption is now stated directly rather than left to create a silent contradiction.

Edge's portal is now, unambiguously, just a real merchant like any other — created and updated on its own schedule, only from certified releases, with no role in the promotion gate. Updated in `delivery/staging-to-template.md`, `delivery/release-checklist.md`, `platform/merchant-deployment-model.md`, and `platform/deployment-and-vercel-model.md` (which now lists both verification projects explicitly, keeping it the true single source of truth for every Vercel project, per its own opening line).

**Outcome:** round 3 closed with the merchant/verification-deployment distinction resolved cleanly, with no exception left implicit. A fourth, full-corpus round (not just these four files) should be run before the architecture is considered frozen, given rounds 1–3 each surfaced a genuine issue.

## Round 4 — 2026-07-23

**Reviewer:** fresh general-purpose agent, full-corpus pass across all 20 files (all nine comprehension questions plus an open-ended cross-file consistency check), not scoped to prior rounds' files.

**Result:** all nine comprehension questions answered cleanly; rounds 1–3's fixes held up under fresh re-verification (no regression). One new, substantive architectural gap was found, not a wording issue: the docs asserted a single global Platform Organisation whose administrators can grant `MerchantCapability` entitlements "for any merchant," while simultaneously asserting every merchant has a fully isolated Vercel project and database, sharing nothing with any other merchant or with Template. No file said where the necessarily cross-merchant data — the Platform Organisation, `CapabilityDefinition`, `MerchantCapability`, `PortalCapabilityAccess`, the signing key — actually lives, given that isolation rule. `deployment-and-vercel-model.md`'s closed project list (which explicitly claims to be the single source of truth for every Vercel project) had no slot for it at all.

**Fix:** introduced the **Platform Registry** as an explicit, named architectural concept — a dedicated central data store, separate from every merchant's database and from Template's own build artifact, holding exactly the cross-merchant data listed above. Deployed as two projects (`portalapp-registry-staging`, `portalapp-registry-production`), one per environment tier, queried live by every merchant deployment and verification project rather than synced locally. Added a new "Where platform data lives" section to `platform/portal-architecture.md`, a new "Platform Registry projects" section to `platform/deployment-and-vercel-model.md`, scoped the merchant-isolation language in `platform/merchant-deployment-model.md` to merchant data specifically (not Registry access), and updated `decisions/0006-platform-administrator-authority.md`'s Consequences to state Platform Administrator authority is enforced against the Registry's data model.

**Outcome:** round 4 closed with the Platform Registry concept added. A fifth round should re-run the full corpus, focusing in particular on whether the Registry concept is now used consistently everywhere it's implied (capability contract, signed launch ticket, integration contract) and doesn't introduce its own new gap.

## Round 5 — 2026-07-23

**Reviewer:** fresh general-purpose agent, full-corpus pass plus a targeted check of whether round 4's Platform Registry concept was applied consistently everywhere it's implied.

**Result:** all nine comprehension questions still answered cleanly; rounds 1–4's fixes held with no regression. The Registry concept itself was found inconsistently applied in four places:

1. `capabilities/signed-launch-ticket.md` still described Portal itself (not the Registry) as holding the private key and publishing the public key, and its `issuer` field description ("identifier for the issuing Portal deployment") implied a per-merchant-deployment key, which cannot be reconciled with one shared key per tier living centrally in the Registry.
2. `decisions/0003-signed-launch-ticket.md`'s Consequences still said "Portal must run and secure the signing key" — not updated to match the centralized model, unlike decision `0006` which was updated in round 4.
3. `delivery/release-checklist.md` and `delivery/staging-to-template.md` never stated that the verification projects (`portalapp-verify-create`, `portalapp-verify-update`) depend on their tier's Registry already existing and being seeded with the three capabilities registered — a silent precondition.
4. The Registry's "query live, not cached" design created a new, unacknowledged tension with this corpus's own repeated principle that one merchant's problem must never affect another's.

**Fix:** rewrote `capabilities/signed-launch-ticket.md`'s Mechanism, Ticket shape (`issuer`), Verification, and Public key discovery sections to route signing and key discovery through the tier's Registry explicitly, with merchant Portal deployments calling the Registry as a signing service rather than holding key material themselves. Updated decision `0003` to match decision `0006`'s centralized-key framing. Added an explicit Registry-dependency statement to `release-checklist.md` items 12–13 (including how `portalapp-verify-create`'s fresh-identity-per-run design keeps it valid against a persistent Registry). Added a "This is a deliberate, accepted shared dependency, not an exception to merchant isolation" paragraph to `platform/portal-architecture.md`, explicitly scoping the isolation principle to merchant data/deployment changes rather than all runtime dependencies, and naming the Registry-outage blast radius as an accepted tradeoff rather than a silent one.

**Outcome:** round 5 closed with four fixes applied. A sixth round should confirm the signed-launch-ticket rewrite didn't introduce its own new inconsistency (e.g., with `capabilities/capability-contract.md`'s "Portal public key reference" language) before considering the architecture frozen.

## Round 6 — 2026-07-23

**Reviewer:** fresh general-purpose agent, explicitly instructed to be skeptical and to check every file (not just the ones round 5 touched) for downstream inconsistency from the Registry rewrite.

**Result:** found the exact regression round 5 flagged as a risk in its own outcome note, just in different files than the one it named. Round 5's rewrite of the key-custody model (Registry signs and holds the key, not Portal) was incomplete — three places still described the pre-round-5 model, contradicting the corrected files:

1. `decisions/0003-signed-launch-ticket.md`'s own **Decision** section (not just its Consequences, which round 5 had fixed) still said "issued by Portal... against Portal's public key" — self-contradictory within the same file.
2. `capabilities/capability-starter.md` called the same published field a "Portal public-key discovery reference," while `capability-contract.md` (already fixed in round 5) correctly called it a "Registry public key reference" — two files disagreeing on what an identical field points to.
3. `platform/portal-architecture.md` — the very section that introduced the Registry concept in round 4 — still had one leftover line saying "a capability queries Portal's public key live," contradicting its own model two paragraphs earlier.

A builder reading `decisions/0003` (the natural stop for "how are launches authenticated," per the README reading order) or `capability-starter.md` (the actual scaffold new capabilities are built from) would have implemented key discovery against the wrong thing.

**Fix:** corrected all three: `0003`'s Decision section now says the ticket is "issued by the Platform Registry... verified... against the Registry's public key"; `capability-starter.md`'s manifest field is now "Registry public-key discovery reference" with an inline note that the Registry, not Portal, holds the key; `portal-architecture.md`'s line now reads "queries the Registry's public key." Ran a full corpus grep for any other "Portal's public/private key" or "Portal issues/holds/signs/publishes...key" phrasing afterward — the only remaining match is this qa-log's own historical record of the round 5 finding, which is correct to leave as-is.

**Outcome:** round 6 closed with three fixes applied, all downstream remnants of round 5's incomplete rewrite. A seventh round should re-verify the key-custody model is now the only version anywhere in the corpus, with fresh eyes, before considering the architecture frozen.

## Round 7 — 2026-07-23

**Reviewer:** fresh general-purpose agent, instructed explicitly to be skeptical given six prior rounds of edits to the same key-custody area, and to check the full corpus rather than only recently-touched files.

**Result:** found two more real issues, neither caught by round 6's grep (which searched for "public key"/"private key" literally):

1. Leftover possessive phrasing "Portal's launch-ticket signing key" in `platform/portal-architecture.md` and `platform/deployment-and-vercel-model.md` — same defect class as rounds 5–6, just a string round 6's grep pattern didn't match.
2. A genuine, previously-unnoticed data-model disagreement: `portal-architecture.md`'s closed list of what the Registry holds (four items: Platform Organisation, `CapabilityDefinition`, `MerchantCapability`, signing key) omitted `PortalCapabilityAccess`, while `deployment-and-vercel-model.md`'s parallel list included it as a fifth item. The two files disagreed on where a real piece of data actually lives — not just wording.

**Fix:** corrected the possessive language in both files to "the launch-ticket signing key" / "the Registry's public key." Resolved the data-model disagreement architecturally, in favor of `portal-architecture.md`'s four-item list: `PortalCapabilityAccess` is a merchant's own Owner/Admin deciding access for their own merchant-local Portal users — a merchant-local decision about merchant-local users, unlike `MerchantCapability` (inherently granted by someone outside the merchant). It lives in each merchant's own database alongside that merchant's own Portal user accounts, not in the Registry. Added an explicit paragraph to `portal-architecture.md` stating this and why, and corrected `deployment-and-vercel-model.md`'s Registry list to match. Ran a targeted grep afterward (`Portal's.*key`, `PortalCapabilityAccess`) across the full corpus to confirm no other file contradicts this — none did.

**Outcome:** round 7 closed with two fixes applied. Given rounds 5–7 all found issues in the same key-custody/Registry area, an eighth round should focus specifically on that area once more, plus a final full-corpus sweep, before the architecture is considered frozen.

## Round 8 — 2026-07-23 — FINAL

**Reviewer:** fresh general-purpose agent, told this was potentially the last round before freeze, instructed to re-verify the Registry data model specifically (given rounds 5–7 all found issues there) plus one more genuinely skeptical full-corpus read.

**Result:** all nine comprehension questions answered cleanly and consistently. The Registry data model check passed: `platform/portal-architecture.md`, `platform/deployment-and-vercel-model.md`, and `decisions/0006` all agree on the same four Registry items (Platform Organisation, `CapabilityDefinition`, `MerchantCapability`, signing key), with `PortalCapabilityAccess` consistently placed in each merchant's own database everywhere it's mentioned. No leftover "Portal's...key" possessive phrasing found anywhere. The full-corpus sweep found no contradictions, undefined terms, or broken cross-references.

One minor, non-blocking completeness note was raised: `platform/deployment-and-vercel-model.md`'s "Old projects: rename, don't delete" list was missing `legacy-storefront`, even though `README.md`'s origin story names Storefront alongside Move and Events as sharing the old pairing ceremony. Not a contradiction — just an incomplete list. Fixed by adding `legacy-storefront` to the list.

**Verdict: READY TO FREEZE.** Eight rounds, each independently reviewed with no memory of prior rounds' specific findings, converged on a consistent architecture. See [`../README.md`](../README.md) — the documentation is now the frozen baseline for building Portal v2, per [`../decisions/`](../) and the platform/capabilities/integrations/delivery docs it links to. Any future change to this architecture should be recorded as a new decision record, not a silent edit to an existing doc.
