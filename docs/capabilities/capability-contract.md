# Application Contract

Every independently deployed first-party application uses the same Merchant
Portal boundary. Applications remain sovereign: they own their sessions,
configuration, APIs, database, user experience, and business data. Portal owns
only merchant-local installation, per-user launch access, and the signed
handover.

## Portal-side entitlement

Portal uses two merchant-local records:

1. `MerchantApplication` stores one `(business, slug)` row, including install
   state and the trusted launch origin.
2. `PortalCapabilityAccess` stores one `(membership, application slug)` row for
   each merchant user allowed to open that installed application.

There is no separate definition or catalogue record. A known application is
added by creating or upserting its `MerchantApplication` row during merchant
setup or update.

Installation and user access are distinct. Installing Move does not flatten
every user's access into a merchant-wide boolean, and granting Move access does
not grant access to Events or Storefront.

## Required application boundary

An application must provide:

- a stable slug and independently deployed trusted origin;
- `POST /api/portal-launch` for the signed handover;
- signature, audience, environment, expiry, and nonce verification;
- its own post-handover session boundary, if it needs a session;
- rejection of direct access to authenticated areas without a valid
  application session; and
- no shared Portal/HQ cookie or database.

Portal sends merchant context and an opaque initiator reference. The application
must not interpret that reference as an instruction to provision a matching
Portal or HQ user. Portal makes no assumption about the application's internal
routes, roles, modules, or product data.

## Move

Move is the first application using this process:

- slug: `move`
- staging origin: `https://move-staging.getedgeportal.app`
- production origin: `https://move.getedgeportal.app`
- launch endpoint: `/api/portal-launch`

No Move route is embedded in Portal. Move sessions and runtime data remain in
Move's own deployment.
