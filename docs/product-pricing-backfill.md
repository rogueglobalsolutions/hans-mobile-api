# Repairing missing product prices and Stripe mappings

## Purpose

The original product catalog had no prices or Stripe mappings. Existing rows can
still contain NULL values even after deployment: migrations do not populate the
catalog, and `seed:products` intentionally preserves existing pricing fields.
MED product details show "Contact for pricing" when the database price is NULL.

This is a one-time, idempotent repair, not a regular catalog sync or a schema
migration. It reads `all_products.json` for live mode or `all_products_test.json`
for test mode. It does not use `PRODUCT_CATALOG_FILE` overrides.

## Safety

- Dry-run is the default; writes require `--apply`.
- `--mode live` or `--mode test` is required and must match `STRIPE_SECRET_KEY`.
- Only NULL `Product.priceCents`, `stripeProductId`, `stripeDefaultPriceId` and
  `ProductVariant.priceCents`, `stripePriceId` are filled.
- Existing values, including zero-priced products and complete Admin-edited
  Stripe mappings, are preserved. Incomplete records with conflicting values
  fail rather than being silently linked to a different Stripe price.
- Prices are retrieved from Stripe and checked for the selected mode, USD,
  active one-time per-unit pricing, amount, and owning active product before
  any database writes. The command never creates prices or charges a card.
- Products match the stable IDs from the seed script; variants match exact
  labels. Unmatched records are reported and skipped, not created or removed.
- Writes use one serializable transaction with a recheck and conditional
  updates. A relevant concurrent Admin edit aborts the repair; rerun the dry-run.
- Stock, visibility, images, credit eligibility, shipping rules, carts, orders,
  enrollments, and existing transaction history are not changed.
- The command is NOT wired into app startup, migrations, seeds, or deployment.

## VPS procedure

Take a database backup first. Deploy the backend code containing this command
through the normal reviewed merge into `main`. No mobile rebuild is needed.
The VPS must retain its existing production `DATABASE_URL` and live
`STRIPE_SECRET_KEY` in its environment or `.env`. Do not paste either key into a
command or commit them. Production-specific environment files take precedence
as defined by `src/config/env.ts`.

From `/srv/hans-mobile-api`, after the normal deployment/build:

```bash
NODE_ENV=production npm run backfill:product-pricing -- --mode live
```

Review the printed database host/name, selected catalog, planned counts, and
Stripe validation result. For the original placeholder database, expect 33
product updates and 99 variant updates. If records were already repaired or
Admin-edited, fewer updates are normal. Resolve any reported conflict first.

Then explicitly apply:

```bash
NODE_ENV=production npm run backfill:product-pricing -- --mode live --apply
```

Rerun the dry-run to confirm "Nothing to backfill", then reopen a MED product
detail and verify its API response includes the USD price and Stripe IDs.
Inventory is deliberately unchanged: products with zero stock still need an
Admin restock before purchase. No service restart is needed for the data repair.

## Development and tests

Build once to generate the CLI and compiled tests:

```bash
npm run build
npm run test:product-backfill
NODE_ENV=development npm run backfill:product-pricing -- --mode test
```

Development uses test keys and `all_products_test.json`. Never repair a live
database with test catalog mappings. Network, key, catalog or Stripe validation
failures happen before writes; transaction failures roll back all updates.

## Verification during implementation

- Backend build and all 23 service tests passed, including 14 backfill tests.
- The existing local database dry-run reported zero missing fields and no writes.
- Disposable local PostgreSQL databases exercised the compiled CLI with two real
  Stripe test prices: read-only dry-run, successful repair, idempotent rerun,
  conflicting Admin price rejection, transaction rollback after a forced second
  variant failure, and an Admin edit during Stripe validation. All passed; the
  disposable databases were removed and existing databases were not modified.
- A read-only production API comparison matched all 33 returned products and 99
  variants to the live catalog, with no unmatched IDs or labels. It planned 33
  product repairs and 99 variant repairs; no production writes were made.
- Live Stripe validation and the production repair must still be run on the VPS
  with its current live key using the procedure above.
