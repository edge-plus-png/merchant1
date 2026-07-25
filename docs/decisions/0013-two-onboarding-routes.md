# 0013 — Two Onboarding Routes, One Front Door

## Decision

There are exactly two supported ways an application joins the platform. Not one per product, not a bespoke process per capability — two routes, chosen by whether the application already exists, and both ending at the identical Merchant Portal front door:

```
Merchant Portal → Apps → Launch → Application
```

**Route A — Migrate an existing application.** The application already exists and already works. It gets a new home, not a rewrite.

```
Existing application → new repository/home (Git, Vercel, database) → implement the Portal launch contract → retire the old entry point → continue development
```

**Route B — Create a new application.** The application does not exist yet. It starts from the capability starter, which is nothing more than the launch contract, session bootstrap, merchant context, logout, health, and deployment shape (see [`capability-starter.md`](../capabilities/capability-starter.md)).

```
Capability starter → implement the Portal launch contract → build the application
```

Once launched, the route an application took is irrelevant. Merchant Portal does not record, check, or care whether an application is twenty years old or was created yesterday — both look identical from Merchant Portal's side: entitled, launchable, and otherwise none of Merchant Portal's business (see [`0011-applications-are-sovereign.md`](0011-applications-are-sovereign.md)).

Move and Tap are on Route A: existing applications getting a new home and the Portal launch contract, not a redesign. Events, Storefront, and Retail are on Route B: new applications starting from the capability starter. This is a statement of which route each currently happens to be on, not a permanent classification — a future application could in principle be either, depending only on whether it already exists.

## Why

Without naming exactly two routes, every new or migrating application invites its own bespoke onboarding conversation — "how should Move join the platform" becomes a different question from "how should Events join the platform," and the answer keeps drifting back into questions about what the application contains internally, which is precisely the territory [`0011-applications-are-sovereign.md`](0011-applications-are-sovereign.md) and [`0012-contracts-not-implementation.md`](0012-contracts-not-implementation.md) rule out. Naming the two routes, and stating that they converge on one identical front door, keeps onboarding a Portal-side, product-agnostic process rather than a new architectural conversation each time.

## Alternatives rejected

- **A different onboarding process per product** — rejected: Move's onboarding and Events' onboarding are not different problems; one is migrating something that exists, the other is building something new. Treating them as product-specific processes reopens exactly the "what does this app contain" question this platform has repeatedly had to correct itself out of.
- **Require every application, including existing ones, to be rebuilt from the capability starter** — rejected: an existing, working application only needs a new front door (the Portal launch contract) and a retired old entry point. Forcing a rebuild destroys working software to satisfy a process that exists to make onboarding easier, not harder.
- **Have Merchant Portal record which route an application took, in case it matters later** — rejected: this is exactly the kind of fact Merchant Portal has no business holding an opinion about once launch succeeds. If it doesn't affect the launch contract, Merchant Portal doesn't need to know it, let alone store it.

## Sequencing: prove Route A before building Route B

The capability starter is not built speculatively ahead of any real use. Route A (migrating Move) is done first. Only once Move is migrated and the sequence `Merchant Portal → Apps → Launch → Move` is proven end to end does work begin on the capability starter that Route B consumes.

This is deliberate, not a scheduling convenience: migrating a real, existing application is what reveals exactly what the common launch behavior actually is — session bootstrap, merchant context, logout, health, deployment shape — because that behavior has to be extracted from working code, not guessed at in the abstract. Building the starter first would mean designing it against assumptions about what a launch needs, then discovering during the Move migration that some of those assumptions were wrong, and revising the starter anyway. Building it after a successful migration means the starter is a proven template, not a theoretical one.

Concretely, the order is: commit the Merchant Platform foundation → migrate Move (Route A) → confirm the full launch sequence works → only then extract the capability starter from what the migration actually required, and use it for the first Route B application (Events, Storefront, or Retail).

## Consequences

The capability starter ([`../capabilities/capability-starter.md`](../capabilities/capability-starter.md)) is what every Route B application consumes, and only what every Route B application consumes: the launch contract, session bootstrap, merchant context, logout, health, and deployment shape — nothing else, per the same reasoning as its existing "opt-in, not default" payment rule. Route A applications never touch the starter; they implement the same launch contract directly against their existing codebase and retire whatever entry point they used before joining the platform. Any future proposal for a third onboarding route, or for route-specific behavior inside Merchant Portal, must be argued as its own decision — not assumed from convenience.
