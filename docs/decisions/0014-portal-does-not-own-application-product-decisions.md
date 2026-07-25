# 0014 — Portal Does Not Own Application Product Decisions

## Decision

Merchant Portal, its architecture, and its documentation never make, record, or imply a product decision on behalf of an application. This is a governance rule, not a technical one — it sits alongside [`0011-applications-are-sovereign.md`](0011-applications-are-sovereign.md) (which governs data, sessions, and technical ownership) and closes a gap that decision left open: even when Portal's documentation makes no technical claim on an application, it can still, in passing, describe what that application *contains* — its product structure, its feature set, its roadmap — and that description itself is a governance failure, independent of whether it's technically accurate.

Concretely:

- ❌ Wrong: "Move contains Counter, Handheld, and Pro."
- ✅ Right: "Merchant Portal launches the Move application." End of discussion.

If the Move team later decides Move has Counter, Kitchen, Bar, and an AI Assistant, Portal does not change, Portal's documentation does not change, and nobody needed to ask Portal first. The application's own team is the only authority on what the application is.

## Why

This is a mistake the project made more than once, from more than one direction, before it was named. Draft architecture documents and ADRs (including earlier drafts of [`0011`](0011-applications-are-sovereign.md) and [`../capabilities/capability-contract.md`](../capabilities/capability-contract.md)) described what Move, Tap, and Retail were presumed to contain — not as a hypothetical illustration, but as if Portal's own documentation were a reasonable place to record it. It happened again in a parallel conversation about the same architecture. The pattern is easy to fall into precisely because it doesn't look like a technical boundary violation — no code reached into another application, no data was shared — it's a narrower, quieter mistake: treating Portal's documentation as an authority on another product's product decisions, when Portal has no standing to be one.

[`0011`](0011-applications-are-sovereign.md) already establishes that Merchant Portal has no technical view into a capability's contents. This decision states the governance consequence plainly, so it stops being something that has to be caught and corrected after the fact: Portal does not own, and must never write down, an opinion about what any application's product is or should be.

## Alternatives rejected

- **Rely on [`0011`](0011-applications-are-sovereign.md) alone** — rejected: 0011 was already in force and the mistake still happened, twice, from two different sources (this project's own drafts and a parallel conversation about the same architecture). A technical-ownership rule does not, on its own, stop someone from writing an illustrative example that describes another application's product structure "just to explain the idea." The governance rule has to be named separately so the specific failure mode — documentation-as-example, not documentation-as-architecture — is recognized and rejected on sight.
- **Allow illustrative, clearly-hypothetical examples of application internals in Portal's docs** — rejected: there is no way to write "Move might contain X, Y, Z" without it being read, eventually, as a description of Move — by a future reader, a future AI assistant working from these docs, or a future contributor who wasn't there for the caveat. The only reliable rule is to never write it, hypothetically or otherwise.

## Consequences

Any future Portal documentation, ADR, diagram, or conversation about the platform's architecture may name an application (Move, Events, Storefront, Retail, Tap) only as a launchable, entitled thing — never by what it contains, how it's structured, or what it should do next. If an example is needed to illustrate a Portal-side concept (entitlement, launch, a contract field), the example must be about the contract itself, not about the application's product. A reviewer or contributor who spots Portal documentation describing an application's internal product structure should treat it as a defect against this decision, not a stylistic nitpick — and it should be removed, not softened.
