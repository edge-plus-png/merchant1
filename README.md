# GetEdgePortal

Portal v2 foundation built against the frozen architecture in [`docs/`](docs/README.md).

This milestone contains only merchant-local Portal concerns: Owner authentication,
business context, Portal roles, the authenticated shell, Users, Settings, the Apps
access boundary/placeholder, health, and the initial Prisma migration. Platform
Registry integration, capability launch tickets, Move, and capability entitlement UI
are intentionally absent.

## Local setup

1. Use Node 24.x and run `npm install`.
2. Copy `.env.example` to `.env` and provide a merchant-local PostgreSQL URL plus a
   strong bootstrap Owner password.
3. Run `npm run prisma:migrate` and `npm run prisma:seed`.
4. Start the app with `npm run dev`.

For the deterministic local/e2e store only, set `PORTAL_DEMO_MODE=true` in a
non-production process. Its test accounts are `owner@example.com` /
`OwnerPass123!` and `lite@example.com` / `LitePass123!`. Demo mode fails closed
when `NODE_ENV=production`.

## Verification

With `DATABASE_URL` configured:

```sh
npm run verify
npm run test:e2e
```

The end-to-end suite proves the Owner login/business-context journey, Users,
Settings, Owner Apps access, Lite Apps denial, unauthenticated route protection,
and `/api/health`.

## Deployment roles

- `staging` → `portalapp-staging` (build/test role)
- `main` → `portalapp-template` (Template release-candidate role)

Both use temporary Vercel-issued URLs until the full foundation gate passes in its
deployed environments. No `getedgeportal.app` domain should be attached before that
deliberate verification step.
