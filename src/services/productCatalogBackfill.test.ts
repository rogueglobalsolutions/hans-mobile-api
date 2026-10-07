import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  CatalogVariantPricing, ProductPricingRecord, RetrievedStripePrice,
  planProductPricingBackfill, readCatalogPricing, stripeKeyMode, validateCatalogStripePrice,
} from "./productCatalogBackfill";

function catalogRows() {
  return { MINT: [
    { product_name: "MINT FINE+", variant: "1 Pouch", product_price: 180, stripeProductId: "prod_mint", stripePriceId: "price_pouch" },
    { product_name: "MINT FINE+", variant: "20 Pouches", product_price: 3600, stripeProductId: "prod_mint", stripePriceId: "price_box" },
  ] };
}

function placeholder(): ProductPricingRecord {
  return { id: "mint_mint-fine", currency: "USD", priceCents: null,
    stripeProductId: null, stripeDefaultPriceId: null,
    variants: [
      { id: "variant-pouch", label: "1 Pouch", priceCents: null, stripePriceId: null },
      { id: "variant-box", label: "20 Pouches", priceCents: null, stripePriceId: null },
    ],
  };
}

function repaired(): ProductPricingRecord {
  const record = placeholder();
  record.priceCents = 18000;
  record.stripeProductId = "prod_mint";
  record.stripeDefaultPriceId = "price_pouch";
  record.variants[0]!.priceCents = 18000;
  record.variants[0]!.stripePriceId = "price_pouch";
  record.variants[1]!.priceCents = 360000;
  record.variants[1]!.stripePriceId = "price_box";
  return record;
}

test("fills placeholder pricing fields only, without mutating inputs", () => {
  const records = [{ ...placeholder(), stockQty: 17, status: "HIDDEN", imageUrl: "keep", orderItems: ["order-1"] }];
  const before = structuredClone(records);
  const plan = planProductPricingBackfill(readCatalogPricing(catalogRows()), records);
  assert.deepEqual(plan.products, [{ id: "mint_mint-fine", data: {
    priceCents: 18000, stripeProductId: "prod_mint", stripeDefaultPriceId: "price_pouch",
  } }]);
  assert.deepEqual(plan.variants, [
    { id: "variant-pouch", productId: "mint_mint-fine", data: { priceCents: 18000, stripePriceId: "price_pouch" } },
    { id: "variant-box", productId: "mint_mint-fine", data: { priceCents: 360000, stripePriceId: "price_box" } },
  ]);
  assert.equal(plan.prices.length, 2);
  assert.deepEqual(records, before);
});

test("backfill is idempotent", () => {
  const catalog = readCatalogPricing(catalogRows());
  const record = placeholder();
  const plan = planProductPricingBackfill(catalog, [record]);
  for (const update of plan.products) Object.assign(record, update.data);
  for (const update of plan.variants) Object.assign(record.variants.find((variant) => variant.id === update.id)!, update.data);
  const rerun = planProductPricingBackfill(catalog, [record]);
  assert.deepEqual(rerun.products, []);
  assert.deepEqual(rerun.variants, []);
  assert.deepEqual(rerun.prices, []);
});

test("preserves complete Admin pricing, including zero and custom Stripe IDs", () => {
  const record = repaired();
  record.priceCents = 0;
  record.stripeProductId = "prod_admin";
  record.stripeDefaultPriceId = "price_admin";
  for (const variant of record.variants) {
    variant.priceCents = 0;
    variant.stripePriceId = "price_custom";
  }
  const plan = planProductPricingBackfill(readCatalogPricing(catalogRows()), [record]);
  assert.deepEqual(plan.products, []);
  assert.deepEqual(plan.variants, []);
});

test("fills only missing fields on matching partial records", () => {
  const record = repaired();
  record.stripeDefaultPriceId = null;
  record.variants[0]!.priceCents = null;
  const plan = planProductPricingBackfill(readCatalogPricing(catalogRows()), [record]);
  assert.deepEqual(plan.products[0]!.data, { stripeDefaultPriceId: "price_pouch" });
  assert.deepEqual(plan.variants[0]!.data, { priceCents: 18000 });
});

test("refuses to pair existing Admin amounts with stale catalog Stripe prices", () => {
  const record = placeholder();
  record.priceCents = 19000;
  assert.throws(() => planProductPricingBackfill(readCatalogPricing(catalogRows()), [record]), /existing priceCents conflicts/);
  const variantRecord = repaired();
  variantRecord.variants[0]!.priceCents = 19000;
  variantRecord.variants[0]!.stripePriceId = null;
  assert.throws(() => planProductPricingBackfill(readCatalogPricing(catalogRows()), [variantRecord]), /existing priceCents conflicts/);
});

test("refuses conflicting partial Stripe mappings and empty-string IDs", () => {
  for (const field of ["stripeProductId", "stripeDefaultPriceId"] as const) {
    const record = placeholder();
    record[field] = "";
    assert.throws(() => planProductPricingBackfill(readCatalogPricing(catalogRows()), [record]), /conflicts with the catalog/);
  }
  const record = repaired();
  record.variants[0]!.priceCents = null;
  record.variants[0]!.stripePriceId = "price_admin";
  assert.throws(() => planProductPricingBackfill(readCatalogPricing(catalogRows()), [record]), /existing stripePriceId conflicts/);
});

test("refuses repairs under a different parent Stripe product or currency", () => {
  const record = repaired();
  record.stripeProductId = "prod_admin";
  record.variants[0]!.stripePriceId = null;
  assert.throws(() => planProductPricingBackfill(readCatalogPricing(catalogRows()), [record]), /parent Stripe product conflicts/);
  const otherCurrency = placeholder();
  otherCurrency.currency = "CAD";
  assert.throws(() => planProductPricingBackfill(readCatalogPricing(catalogRows()), [otherCurrency]), /currency is not USD/);
});

test("skips unmatched products and variants; never creates or deletes records", () => {
  const record = repaired();
  record.variants.push({ id: "extra", label: "Admin variant", priceCents: null, stripePriceId: null });
  const custom = { ...placeholder(), id: "admin-product" };
  const plan = planProductPricingBackfill(readCatalogPricing(catalogRows()), [record, custom]);
  assert.deepEqual(plan.skippedProducts, ["admin-product"]);
  assert.deepEqual(plan.skippedVariants, ["extra"]);
  assert.deepEqual(plan.products, []);
  assert.deepEqual(plan.variants, []);
  const missing = planProductPricingBackfill(readCatalogPricing(catalogRows()), []);
  assert.deepEqual(missing.missingProducts, ["mint_mint-fine"]);
  assert.deepEqual(missing.products, []);
});

test("rejects ambiguous catalog and database variants", () => {
  const rows = catalogRows();
  rows.MINT.push({ ...rows.MINT[0]! });
  assert.throws(() => readCatalogPricing(rows), /Duplicate catalog variant/);
  const record = placeholder();
  record.variants.push({ ...record.variants[0]!, id: "duplicate" });
  assert.throws(() => planProductPricingBackfill(readCatalogPricing(catalogRows()), [record]), /Duplicate database variant/);
});

test("rejects invalid amounts and missing or inconsistent catalog Stripe mappings", () => {
  for (const amount of [-1, NaN, 1.001, 21474836.48]) {
    const rows = catalogRows();
    rows.MINT[0]!.product_price = amount;
    assert.throws(() => readCatalogPricing(rows), /Invalid catalog price/);
  }
  const noPrice = catalogRows();
  noPrice.MINT[0]!.stripePriceId = "";
  assert.throws(() => readCatalogPricing(noPrice), /Missing or invalid Stripe mapping/);
  const inconsistent = catalogRows();
  inconsistent.MINT[1]!.stripeProductId = "prod_other";
  assert.throws(() => readCatalogPricing(inconsistent), /Inconsistent Stripe product/);
  assert.throws(() => readCatalogPricing({}), /empty/);
});

test("parses both real catalogs as 33 products and 99 fully mapped variants", () => {
  const catalogs = ["all_products.json", "all_products_test.json"].map((file) =>
    readCatalogPricing(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "prisma", "data", file), "utf8"))));
  for (const catalog of catalogs) {
    assert.equal(catalog.length, 33);
    assert.equal(catalog.reduce((sum, product) => sum + product.variants.length, 0), 99);
  }
  const liveIds = new Set(catalogs[0]!.flatMap((product) => product.variants.map((variant) => variant.stripePriceId)));
  assert.equal(catalogs[1]!.flatMap((product) => product.variants).some((variant) => liveIds.has(variant.stripePriceId)), false);
});

test("rejects using publishable keys or unknown credentials", () => {
  assert.equal(stripeKeyMode("sk_live_example"), "live");
  assert.equal(stripeKeyMode("rk_test_example"), "test");
  for (const key of ["", "pk_live_example", "sk_unknown_example"]) assert.throws(() => stripeKeyMode(key), /secret or restricted/);
});

const target: CatalogVariantPricing = { label: "Pouch", priceCents: 18000, stripePriceId: "price_pouch", stripeProductId: "prod_mint" };
const stripePrice: RetrievedStripePrice = { id: "price_pouch", active: true, livemode: true, currency: "usd",
  type: "one_time", billing_scheme: "per_unit", unit_amount: 18000, product: { id: "prod_mint", active: true } };

test("accepts only matching active one-time Stripe prices", () => {
  assert.doesNotThrow(() => validateCatalogStripePrice(target, stripePrice, "live"));
  assert.doesNotThrow(() => validateCatalogStripePrice(target, { ...stripePrice, livemode: false }, "test"));
  for (const override of [
    { id: "price_other" }, { active: false }, { livemode: false }, { currency: "cad" },
    { type: "recurring" }, { billing_scheme: "tiered" }, { unit_amount: null }, { unit_amount: 19000 },
    { product: "prod_other" }, { product: { id: "prod_mint", deleted: true } },
    { product: { id: "prod_mint", active: false } },
  ]) assert.throws(() => validateCatalogStripePrice(target, { ...stripePrice, ...override }, "live"), /Stripe validation failed/);
});

test("CLI requires explicit mode and rejects mode mismatch even with --apply", () => {
  const script = path.join(__dirname, "..", "scripts", "backfillProductPricing.js");
  for (const args of [[], ["--mode", "live", "--apply"], ["--mode", "test", "--apply", "--dry-run"], ["--mode", "test", "--unknown"]]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      env: { ...process.env, STRIPE_SECRET_KEY: "sk_test_not_a_real_key", DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused" },
      encoding: "utf8", timeout: 10_000,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal((result.stdout + result.stderr).includes("sk_test_not_a_real_key"), false);
    assert.equal((result.stdout + result.stderr).includes("APPLY:"), false);
  }
  const help = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8", timeout: 10_000 });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Dry-run is the default/);
});
