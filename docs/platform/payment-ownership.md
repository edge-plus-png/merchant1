# Payment Ownership

## Rule

Portal is the only system that ever executes a payment. This includes Hosted Checkout, Virtual Terminal, and Pay by Link, regardless of which capability or integration initiated the request. See [`../decisions/0001-portal-owns-payments.md`](../decisions/0001-portal-owns-payments.md).

## What capabilities store

A capability (Events, Storefront, or any future capability that needs to take payment) never stores card data, gateway credentials, or payment state of its own. It stores:

- its own domain object (an Events booking, a Storefront order)
- a reference to the Portal payment that was created for it (a payment or Hosted Checkout session ID)
- the last-known status Portal reported for that reference (e.g. paid, refunded, failed)

The capability's own record is a receipt, not a ledger. Portal's record is the ledger.

## How a capability takes payment

1. The capability requests a Hosted Checkout session (or Payment Link, or Virtual Terminal charge) from Portal, scoped to the merchant the capability's current launch ticket identifies.
2. Portal creates and owns that payment object, executes it via NMI, and returns status and a reference to the capability.
3. The capability stores the reference and status against its own domain object and reacts to status changes (e.g. marks a booking confirmed) but never re-implements payment execution itself.

## Refunds

Refunds follow the same ownership. A capability that needs to refund a payment sends a refund request against the Portal payment reference it was given — it does not attempt to refund via its own gateway credentials, because it does not have any. Portal validates the request against the merchant and the original payment, performs the refund via NMI, and reports the result back to the capability, which updates its own record accordingly.

## Integrations and payments

Integrations that touch money (e.g. an integration that creates a Payment Link from a Monday.com board item) go through the same Portal payment ownership — an integration is a caller of Portal's payment capability, exactly like a first-party capability is, and never holds its own gateway credentials either. See [`../integrations/integration-contract.md`](../integrations/integration-contract.md).
