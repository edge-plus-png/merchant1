# Merchant 1 portal

This repository is the source of truth for the Merchant 1 production portal at
`merchant.getedgeportal.app`.

## Release policy

- Production releases come from the GitHub `main` branch through Vercel's Git integration.
- Do not run direct `vercel deploy` or `vercel --prod` releases for this project.
- Keep merchant-specific changes in this repository. Template promotion is a separate, deliberate process.

## Local verification

```sh
npm ci
npm test
npm run build
```

## Production configuration

The portal requires `DATABASE_URL`, `HQ_ACCESS_PUBLIC_KEY`, and `CRON_SECRET` in
Vercel Production. `PORTAL_CANONICAL_URL` can be used to pin the accepted portal
origin. The daily HQ access cleanup is configured in `vercel.json`.
