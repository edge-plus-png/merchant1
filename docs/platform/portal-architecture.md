# Portal Architecture

## The three products

GetEdgePortal consists of three products with separate identity and session
boundaries:

1. **HQ** — cross-merchant management for Edge and affiliate organisations.
2. **Merchant Portal** — the merchant control plane. Every merchant has its own
   Portal deployment and database.
3. **Applications** — independently deployed first-party products launched by
   Merchant Portal in a merchant context.

HQ is not a role inside Merchant Portal. Merchant Portal is not a view into HQ.
An application is not an extension of either product's session.

## What Merchant Portal owns

Merchant Portal owns merchant identity, the merchant record, Portal users,
application entitlement and launch, payments, integrations, and shared merchant
settings. It does not own application-internal sessions, routes, data, or product
decisions.

Move, Events, Storefront, and future applications run independently in their
own Vercel projects. Their browser-visible routes occupy unique Portal-owned
zones, while their upstream deployment, session, data, and releases remain
independent. Portal's application responsibility ends after an authorized,
signed handover and secure namespace routing.

## Where application entitlement lives

Each merchant deployment stores its own entitlement state directly in its own
database. There are exactly two records in this model:

1. **`MerchantApplication`** — one row per `(business, slug)`. It records which
   applications this merchant has, whether each is installed, and the trusted
   launch origin. A row may exist in `NOT_INSTALLED` state so the application can
   be offered for installation.
2. **`PortalCapabilityAccess`** — one row per `(merchant membership,
   application slug)`. It records which installed applications that specific
   merchant user may open. This remains per application: access to Move does not
   imply access to Events or Storefront.

There is no generic application catalogue, central entitlement service, or
third application-definition table. With one merchant and a small set of known
applications, Template and merchant deployment code create the required
`MerchantApplication` rows directly.

`EDGE_FULL_ACCESS` is a session-level authority. It may install and open an
application while setting up a merchant without creating a
`BusinessMembership`, Owner grant, or `PortalCapabilityAccess` row. Read-only HQ
support sessions cannot install or launch applications.

## Applications vs. integrations

An **application** is a first-party product that:

- runs independently at its own trusted origin;
- is represented by a merchant-local `MerchantApplication` row;
- is opened through a signed POST handover;
- creates and owns any session or runtime data it needs after handover; and
- shares no cookie or database with Portal.

An **integration** is a connection to a third-party system that runs inside the
owning product's connection or webhook infrastructure. It is configured rather
than launched and does not appear in My Apps.

## Who can do what

- **Edge full-access sessions** may install and open merchant applications as a
  session-level product-owner authority. They create no merchant membership or
  per-user application grant.
- **Merchant Owners/Admins** may install applications for their own business and
  manage per-user `PortalCapabilityAccess` for their own memberships.
- **Merchant users** may open only installed applications for which their own
  membership has `PortalCapabilityAccess`.
- **Read-only HQ support sessions** may inspect application state but may not
  install or open applications.

## Signed launch boundary

When an authorized principal opens an installed application, Merchant Portal
creates a short-lived Ed25519-signed ticket and submits it by POST to the
application's fixed zone endpoint, for example
`/apps/move/api/portal-launch`. The ticket carries merchant,
environment, entitlement, expiry, nonce, and an opaque initiator reference. It
does not carry a Portal cookie, HQ access ticket, or reusable credential.

The application verifies the ticket and then owns everything after acceptance.
Portal routes the application namespace but does not render or store application
sessions or runtime data. The proxy removes Portal/HQ cookies and forwards only
the application's path-scoped session cookie.

## What HQ owns

HQ owns HQ identities, memberships, sessions, the merchant directory,
affiliate assignments, merchant-access ticket issuance, and HQ-side ticket
issuance evidence. An authorized HQ user enters the merchant's own Portal only
through a short-lived, one-use merchant-access ticket. The resulting
merchant-local session remains distinct from any merchant membership.

The HQ-to-Merchant ticket and the Merchant Portal-to-application launch ticket
are separate contracts with separate audiences and cookies.

## Product identity boundaries

- HQ users authenticate only to HQ.
- Merchant users authenticate only to their merchant's Portal.
- Applications receive a signed merchant-context handover, not a Portal or HQ
  account to provision.
- Cookies and sessions are host-scoped and never shared across products.
