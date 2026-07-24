# 0008 — HQ-Managed Capability Launch Preserves the Merchant Boundary

## Decision

An HQ-managed session does not launch a capability directly. It requests the action from the target Merchant Portal. Merchant Portal first authorizes the request against the merchant, its `MerchantCapability` entitlement, and the HQ-managed session's access mode. It does not create or require `PortalCapabilityAccess` for the HQ operator, because that record grants capability access only to merchant Portal users. Only then does Merchant Portal use the existing capability launch mechanism.

The capability launch ticket contains the target merchant context and an opaque merchant-local audit reference in `initiatedBy`. For an HQ-managed launch that reference is the HQ-managed session's audit identifier. It is not an HQ account, merchant account, or instruction to provision an application user.

The HQ merchant-access ticket, HQ cookie, HQ-managed session identifier, and HQ authorization claims are never sent to the capability. The capability creates and owns its normal, separate capability session.

## Why

Merchant Portal remains the authority for merchant capability entitlement and launch. This preserves the existing capability contract, keeps capabilities independent of HQ membership and ticket verification, and provides an audit correlation point without representing the HQ operator as the merchant Owner or as a capability user.

## Alternatives rejected

- **HQ issues capability launch tickets directly** — rejected because it bypasses Merchant Portal's merchant entitlement and access-mode checks and couples capabilities to HQ authorization.
- **Provision the HQ operator as a merchant or capability user** — rejected because it turns temporary managed access into persistent membership and misstates the operator's identity.
- **Forward the HQ merchant-access ticket to a capability** — rejected because the ticket has a different audience and trust boundary and must be consumed only by the target Merchant Portal.

## Consequences

Merchant Portal must record the HQ operator and session locally before capability launch and retain the mapping from the opaque `initiatedBy` audit reference to that evidence. Capability activity can be correlated to the Merchant Portal audit chain, but the capability does not receive an HQ user as an application user.
