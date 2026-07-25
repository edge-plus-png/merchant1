# 0012 — Applications Communicate Through Contracts, Never Implementation

## Decision

Every cross-boundary interaction in GetEdgePortal — capability to Payment Platform, Merchant Portal to capability, HQ to Merchant Portal — is a named contract: a fixed request/response shape with an explicit meaning. Nothing on either side of a boundary may depend on how the other side is actually built. An application knows the contracts it calls. It does not know, and must not come to depend on, what sits behind them.

Concretely: a capability asks the Payment Platform to *create a payment*, *check a payment's status*, or *refund a payment*. It does not know, and the contract must never leak, that the Payment Platform happens to use NMI, or Elavon, or that "create a payment" is implemented today as a Hosted Checkout session versus a Virtual Terminal charge versus a Pay by Link. Move doesn't know NMI. Events doesn't know how Hosted Checkout works internally. Both know only the contract: what they can ask for, and what shape comes back.

The same rule applies to every other boundary already defined: a capability knows the signed-launch-ticket contract, not how the issuing Merchant Portal deployment signs it ([`signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md)). Merchant Portal knows the HQ merchant-access-ticket contract, not HQ's internal session or directory implementation ([`0007-hq-merchant-access.md`](0007-hq-merchant-access.md)). This decision names the general principle those specific contracts were already following.

## Why

Sovereignty ([`0011-applications-are-sovereign.md`](0011-applications-are-sovereign.md)) says each side of a boundary owns its own implementation. This decision says the boundary itself must be the only thing either side is allowed to know about the other. Without it, sovereignty erodes quietly: a capability starts branching on "is this Hosted Checkout or Virtual Terminal," or the Payment Platform starts special-casing "if the caller is Move, do X" — and now both sides depend on facts the contract never promised to hold still. The gateway provider, the payment method, the capability's own database, and the Payment Platform's internal routing all become free to change independently only if neither side ever reached past the contract to find out how the other side works.

## Alternatives rejected

- **Let capabilities branch on payment method or provider when convenient** — rejected: the moment a capability's code path depends on "this is a Hosted Checkout session, not a Virtual Terminal charge," changing the Payment Platform's internal implementation becomes a breaking change for every capability that peeked.
- **Document the contract loosely and let the reference implementation be the real specification** — rejected: an implicit contract ("just look at what Move currently does") reintroduces the same coupling this decision exists to prevent, just without the documentation to enforce it.
- **Allow a documented exception for "trusted" internal capabilities to call the Payment Platform's internals directly for efficiency** — rejected: a trusted exception is still an exception, and it is exactly the kind of one-off shortcut that later gets pointed to as precedent for the next shortcut.

## Consequences

Every boundary in this platform must have a named, versioned contract before anything is built against it — the capability contract, the signed launch ticket, the HQ merchant-access ticket, and the Payment Platform's create/status/refund contract are the existing examples. Changing what sits behind a contract (swapping a gateway, changing how a ticket is signed, moving where a session is stored) must never require a change on the other side, provided the contract's shape and meaning stay the same. Any new cross-boundary interaction is reviewed against this decision before it ships: can the caller state what it's asking for and what it expects back without naming how the other side does it? If not, the contract isn't finished yet.
