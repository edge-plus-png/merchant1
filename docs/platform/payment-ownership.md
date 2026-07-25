# Payment Ownership: the Payment Platform

## Rule

Merchant Portal is, in effect, two things: a Merchant Platform (identity, business, users, apps) and a **Payment Platform** (Hosted Checkout, Virtual Terminal, Pay by Link, and NMI card-present). The Payment Platform is the only system that ever executes a payment, regardless of which capability or integration initiated the request. See [`../decisions/0001-portal-owns-payments.md`](../decisions/0001-portal-owns-payments.md).

The Payment Platform is the one named exception to capability sovereignty ([`../decisions/0011-applications-are-sovereign.md`](../decisions/0011-applications-are-sovereign.md)) — a name, not a category. There is no generic "shared services" bucket this belongs to; it is bounded by four rules so the exception doesn't widen into a general excuse for Merchant Portal to own application behavior:

1. **Contract, not data access.** A capability requests a payment action (create, check status, refund) and gets back a reference and a status. The Payment Platform never reads a capability's own database to reconcile anything, and a capability never reads the Payment Platform's tables directly — see "How a capability takes payment" below for the actual sequence.
2. **Execution, not orchestration.** The Payment Platform executes payments. Applications orchestrate payment journeys. The Payment Platform creates a Hosted Checkout session, processes a charge, or performs a refund — and stops there. It never decides what happens next in a capability's own domain: it never marks an Event confirmed, never advances a Move order's state, never touches a capability's own records at all. The capability that owns the booking, order, or basket is the only thing that acts on a payment's outcome.
3. **Opt-in, not default.** A new capability is not scaffolded with Hosted Checkout, or any payment integration, wired in by default (see [`../capabilities/capability-starter.md`](../capabilities/capability-starter.md)). The payment contract is added when the capability's real requirements need it. Events, for example, does not need Hosted Checkout the day it's created — it's added later, when the real booking flow requires it, not baked into the starter on the assumption it'll be needed eventually.
4. **Scoped to payments, not "shared services" generally.** This exception is about payment execution specifically. It is not a precedent for Merchant Portal to default into owning any other cross-capability concern — each such case must be decided on its own terms, the way this one was.

## What capabilities store

A capability (Events, Storefront, or any future capability that needs to take payment) never stores card data, gateway credentials, or payment state of its own. It stores:

- its own domain object (an Events booking, a Storefront order)
- a reference to the Portal payment that was created for it (a payment or Hosted Checkout session ID)
- the last-known status Portal reported for that reference (e.g. paid, refunded, failed)

The capability's own record is a receipt, not a ledger. Portal's record is the ledger.

## How a capability takes payment

1. The capability requests a Hosted Checkout session (or Payment Link, or Virtual Terminal charge) from the Payment Platform, scoped to the merchant the capability's current launch ticket identifies.
2. The Payment Platform creates and owns that payment object, executes it via NMI, and returns status and a reference to the capability. It stops there — it does not act on the capability's own domain object.
3. The capability stores the reference and status against its own domain object and decides what happens next: it reacts to status changes (e.g. marks a booking confirmed, advances an order's state) but never re-implements payment execution itself.

Concretely: Events owns booking, attendee, cancellation, and confirmation. It asks the Payment Platform to create a Hosted Checkout session; the Payment Platform does, and nothing else — it never updates an Event. Events alone decides what happens after payment succeeds or fails. The same applies to Move: Move owns the order, the Payment Platform processes the payment, and Move decides the order's next state.

## Refunds

Refunds follow the same ownership. A capability that needs to refund a payment sends a refund request against the Portal payment reference it was given — it does not attempt to refund via its own gateway credentials, because it does not have any. Portal validates the request against the merchant and the original payment, performs the refund via NMI, and reports the result back to the capability, which updates its own record accordingly.

## Integrations and payments

Integrations that touch money (e.g. an integration that creates a Payment Link from a Monday.com board item) go through the same Portal payment ownership — an integration is a caller of Portal's payment capability, exactly like a first-party capability is, and never holds its own gateway credentials either. See [`../integrations/integration-contract.md`](../integrations/integration-contract.md).
