# OCI Object Storage Cost Calculator

An interactive planning calculator for comparing OCI Object Storage Standard,
Infrequent Access, and Archive tiers. Estimates include storage, requests,
retrieval, restored Archive copies, early-deletion adjustments, and outbound
transfer.

All displayed estimates are in AUD. Oracle's public USD rates are converted
using the exchange-rate assumption shown in the calculator.

## Local preview

```bash
npm run dev
```

Open <http://127.0.0.1:4173>.

## Build

```bash
npm run build
```

The static Pages output is written to `dist/server/public`.

## Cloudflare Workers

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Configuration: `wrangler.jsonc`

The Git integration deploys the Worker and static assets together. The
production branch is `main`.

This is a directional planning tool, not an Oracle quote. Verify estimates
against your OCI tenancy, region, and contract before committing budget.
