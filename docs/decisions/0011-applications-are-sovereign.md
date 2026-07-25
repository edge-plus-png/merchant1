# 0011 — Applications Are Sovereign

## Decision

Every capability owns its own business data, sessions, configuration, APIs, database, and user experience. Merchant Portal provides identity, merchant entitlement, and launch — nothing else. Merchant Portal must never implement application functionality, and must never store, derive, or synchronize a capability's own operational state, unless the capability explicitly delegates that function to Merchant Portal through a named, deliberate exception (see "The one deliberate exception" below).

In conversation this is "what happens in the app stays in the app." As an architectural principle it is more precisely: **applications are sovereign.**

## Merchant Portal's responsibility ends at launch

Merchant Portal's job toward any capability is exactly this and nothing more:

```
Login → Merchant → Business → Users → Apps → Launch <capability>
```

Once that launch ticket is issued and accepted, Merchant Portal is finished. It does not enter the capability, does not redesign it, does not structure it, and does not hold or act on any assumption about what the capability contains internally. Whether a capability is one module or five, whether it's rewritten completely next quarter, whether it merges two products into one internally or splits one into three — Merchant Portal does not change, because Merchant Portal never had an opinion on any of that in the first place. Only the capability's own team decides what the capability contains.

This is the harder and more durable form of sovereignty. It's not "Merchant Portal describes what a capability should contain and then leaves it alone" — it's "Merchant Portal has no view into a capability's contents at all." This document does not enumerate what Move, Tap, Retail, Events, or Storefront contain internally, on purpose: that would itself be Merchant Portal (and this architecture) reaching into a capability's business, which is exactly what sovereignty forbids. Any such detail belongs entirely to that capability's own project, never to Merchant Portal's documentation.

## The domain-ownership test

This is a tool for whoever builds a capability to use when deciding their own internal module boundaries. It is not something Merchant Portal applies, checks, or has an opinion on — Merchant Portal doesn't see the answer and doesn't need to.

The test: *if I change the catalogue, who should know?* If the answer includes multiple surfaces of the same product, those surfaces belong in one capability, because they're views onto the same operational model. If the answer is "nobody — this is a different business domain," that's a separate capability, even if it happens to share a merchant or a payment channel with another one. Splitting by screen, device, or integration technology (handheld vs. terminal, app2app vs. not) produces the wrong boundary; splitting by who owns the business data produces the right one.

That test belongs to each capability's own team to apply to their own product. It does not license Merchant Portal, or this architecture, to prescribe what any specific capability actually contains.

## The one deliberate exception: the Payment Platform

Sovereignty has exactly one named exception, and it has a name, not a category: the **Payment Platform**. There is no generic "shared services" bucket — if there were, any future cross-cutting idea could claim a seat in it. There is exactly one thing that lives outside capability sovereignty, and it is Merchant Portal's payment execution (Virtual Terminal, Pay by Link, Hosted Checkout, NMI card-present, and the underlying gateway credentials), because none of that is naturally part of any single capability's own business domain — it's a capability every application may need. See [`../platform/payment-ownership.md`](../platform/payment-ownership.md) for the full contract.

Put plainly: Merchant Portal is evolving into two things — a **Merchant Platform** (identity, business, users, apps) and a **Payment Platform** (Hosted Checkout, Virtual Terminal, Pay by Link, card-present). Everything else belongs to applications. If, years from now, something else (reporting, notifications) earns shared status, it earns that status by solving a real cross-application problem argued on its own terms — not because an architecture had a vague "shared services" bucket waiting for it.

This exception does not reopen the boundary generally. It is bounded by four rules, all already true of the payment contract and now stated as load-bearing constraints rather than incidental description:

1. **Contract, not data access.** A capability requests a payment action (create, check status, refund) and receives a reference and a status. Merchant Portal never reads a capability's own database to reconcile anything, and a capability never reads Merchant Portal's payment tables directly.
2. **Execution, not orchestration.** The Payment Platform executes payments. Applications orchestrate payment journeys. Merchant Portal creates a Hosted Checkout session, processes a charge, or performs a refund — full stop. It never decides what an Event, a Move order, or any other capability's domain object does next. Events owns booking, attendee, cancellation, and confirmation; it asks the Payment Platform to create a Hosted Checkout session, the Payment Platform does it, and Events alone decides what happens after — the Payment Platform never updates an Event. The same applies to Move: Move owns the order, the Payment Platform processes the payment, Move decides the next state.
3. **Opt-in, not default.** A new capability is not scaffolded with Hosted Checkout (or any payment integration) wired in by default. The payment contract is added when the capability's actual requirements require it — Events does not need Hosted Checkout the day it is created, and the capability starter must not presume it will.
4. **Scoped to payments, not "shared services" generally.** The Payment Platform covers payment execution specifically. It does not establish a precedent that any future cross-capability concern (reporting, notifications, or anything else) may default to Merchant Portal ownership — each such case must be argued and decided on its own, the way payments was.

## Why

The earlier Move implementation felt wrong for exactly this reason: as soon as Merchant Portal began creating Move sessions and storing Move runtime configuration, it stopped being a launcher and started becoming part of Move itself. A platform where the control plane accretes pieces of every application's behavior is not a platform — it is a monolith with extra deployment steps. Naming sovereignty as an absolute rule, with one narrowly-bounded exception, keeps Merchant Portal small indefinitely and lets every capability evolve independently (different database, different runtime, different session model, different internal module structure) without Merchant Portal ever needing to change — and without Merchant Portal's own documentation needing to describe what changed.

## Alternatives rejected

- **Split a capability into separate apps by device or channel** — rejected as a general pattern: if one operational model is fractured across codebases that must stay in lockstep, that recreates the coordination cost the capability boundary exists to avoid. (This is a rule for whoever builds a capability to apply to their own product, per the domain-ownership test above — not something Merchant Portal decides on any capability's behalf.)
- **Let Merchant Portal document or assume what a specific capability contains** — rejected: even framed as a helpful example, this reaches into a capability's own business decisions. A capability's internal structure can change at any time without that being Merchant Portal's concern, and Merchant Portal's documentation describing it, even descriptively, creates an expectation that isn't Merchant Portal's to set.
- **Let Merchant Portal own any "shared" concern by default, not just payments** — rejected: without a named, narrow exception, every future cross-cutting idea (reporting, notifications, a shared search index) becomes a plausible reason to grow Merchant Portal, and the sovereignty principle erodes one convenience at a time.
- **Scaffold every new capability with Hosted Checkout pre-wired, since most will need it eventually** — rejected: presumes a requirement before it exists and gives Merchant Portal's payment contract more surface area inside a capability than that capability currently needs, which is exactly the coupling this decision exists to prevent.

## Consequences

Merchant Portal never owns a capability's sessions, users, permissions, configuration, routes, UI, APIs, or database. A capability may own absolutely anything it needs internally, including a different database, different session model, or different runtime, as long as it implements the capability contract ([`../capabilities/capability-contract.md`](../capabilities/capability-contract.md)) at its boundary. The one exception — the Payment Platform — is documented in [`../platform/payment-ownership.md`](../platform/payment-ownership.md) and is bounded by the contract-not-data-access, execution-not-orchestration, opt-in-not-default, and payments-only rules above. Merchant Portal is Merchant Platform plus Payment Platform; there is no third, generic category. Any future proposal to have Merchant Portal own something beyond identity, entitlement, launch, or payments must be argued as its own decision record, not assumed from this one.
