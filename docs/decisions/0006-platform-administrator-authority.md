# 0006 — Merchant-Local Application Entitlement

## Decision

Application entitlement is merchant-local and uses only
`MerchantApplication` plus `PortalCapabilityAccess`.

`MerchantApplication` records whether a known application is installed for a
business and where it launches. `PortalCapabilityAccess` records which specific
merchant memberships may open which installed applications.

There is no separate application-definition table or generic catalogue.

## Authority

Merchant Owners/Admins may install applications and manage per-user application
access for their own merchant. An `EDGE_FULL_ACCESS` session may perform the
same setup work as session-level authority without creating a merchant
membership or access row. Read-only HQ support cannot change or launch an
application.

## Consequences

Every merchant deployment owns its own application rows. Template and merchant
update code create known application rows directly. Adding another application
means adding another `MerchantApplication` slug and its independent launch
contract; it does not require new shared infrastructure or a new permission
shape.
