# 0010 — HQ Has Isolated Staging and Production Deployments

## Decision

HQ uses two dedicated Vercel projects from the existing PortalApp source
repository:

| Environment | Vercel project | Branch | Domain |
|---|---|---|---|
| Staging | `portalapp-hq-staging` | `staging` | Temporary Vercel URL first; then `hq-staging.getedgeportal.app` after verification |
| Production | `portalapp-hq` | `main` / release | `hq.getedgeportal.app` |

Each environment has its own database, HQ signing key, HQ identities, sessions,
merchant directory, ticket replay state, and audit evidence. Production data or
credentials are never copied into staging. Staging merchant Portals trust only the
staging HQ public key; production merchant Portals trust only the production HQ
public key.

The two projects may deploy the same source repository because product separation
is enforced by independent deployments, origins, configuration, credentials, data
stores, and sessions. `PORTAL_SURFACE=HQ` is set independently in both projects.

An HQ release is promoted by verifying a specific commit in staging and then
merging or promoting that exact commit to the production branch. Production is
never deployed from an uncommitted local working tree.

## Why

Once `hq.getedgeportal.app` became the live HQ origin, a temporary proof deployment
was no longer a safe place to test changes. Vercel preview deployments of the
production project do not provide a sufficiently explicit boundary because their
environment variables can be misconfigured against production resources. A
separate staging project makes the database, signing key, hostname, branch, and
deployment history independently auditable.

## Consequences

`portalapp-hq-proof` is replaced by `portalapp-hq-staging` and `portalapp-hq` in the
deployment inventory. This decision supersedes only the temporary project naming
and domain-attachment timing in decision 0007; its identity, ticket, session,
authorization, and audit boundaries remain unchanged.

Automatic Git deployment may be enabled only after the deployed HQ source is
committed and the two projects are pinned to their intended branches. Staging must
be operational and verified before the staging custom domain is attached.
