# 0006 — Platform Administrator Authority

## Decision

There is exactly one Platform Organisation. Only Platform Administrators (members of that organisation) may create or register `CapabilityDefinition` rows, or grant/revoke a merchant's `MerchantCapability` entitlement. Merchant organisations can only enable or disable, for their own users, capabilities they have already been granted (`PortalCapabilityAccess`) — they cannot register new capabilities or grant themselves entitlements. This is an explicit architectural concept (a specific organisation, created during Portal's own bootstrap), not a runtime configuration value.

## Why

The previous approach (`PLATFORM_ORGANISATION_SLUG`, an environment variable compared against the session's organisation slug at request time) fails closed if unset, which is safe, but it hides a core authorization boundary inside deployment configuration rather than the data model — an operator misconfiguring or omitting an env var is an availability bug in this scheme, but the deeper problem is that "who is allowed to register capabilities" should be answerable by reading the architecture and the data, not by checking what a specific deployment's environment variables happen to be set to.

## Alternatives rejected

- **`PLATFORM_ORGANISATION_SLUG` environment variable comparison** — rejected as the sole mechanism: it works, but it is configuration standing in for what should be a first-class relationship (an actual Platform Organisation row that either exists and is unique, or doesn't).
- **Any organisation-wide OWNER/ADMIN membership counts as platform authority** — rejected: this is exactly the gap the original App Installer fix (`isPortalAppInstallerAdmin` alone) had — org-wide OWNER/ADMIN is equally true of any merchant's own admin on their own deployment, so it is not Edge-specific on its own.

## Consequences

The Platform Organisation, and the `CapabilityDefinition`/`MerchantCapability` rows it administers, live directly inside that same Merchant Portal deployment's own database, created during that deployment's own bootstrap — there is no separate, centrally-deployed store for this (see [`../platform/portal-architecture.md`](../platform/portal-architecture.md), "Where platform data lives"). This is consistent with every Merchant Portal deployment being fully isolated (see [`../platform/merchant-deployment-model.md`](../platform/merchant-deployment-model.md)): each deployment's own bootstrap must create exactly one Platform Organisation row and must prevent a second one from being created within that deployment. How the same `CapabilityDefinition` rows come to exist consistently across every deployment (so "Move exists and can be launched" is the same fact everywhere) is a question for how Template is built and promoted, not a question that needs new cross-merchant infrastructure to answer. Platform Administrator authority checks are implemented against this organisation's identity in the deployment's own data model, not against an environment variable. (An environment-variable-based check may still exist as a defense-in-depth or migration aid, but it is not the authoritative mechanism.)
