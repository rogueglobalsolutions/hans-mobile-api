import "../config/env";
import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import {
  CatalogMode, planProductPricingBackfill, readCatalogPricing, stripeKeyMode, validateCatalogStripePrice,
} from "../services/productCatalogBackfill";

const productSelect = {
  id: true, currency: true, priceCents: true, stripeProductId: true, stripeDefaultPriceId: true,
  variants: { select: { id: true, label: true, priceCents: true, stripePriceId: true }, orderBy: { id: "asc" } },
} satisfies Prisma.ProductSelect;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: npm run backfill:product-pricing -- --mode live|test [--dry-run | --apply]");
    console.log("Dry-run is the default. Only NULL prices and Stripe mappings are filled; Stripe is read-only.");
    return;
  }
  let mode: CatalogMode | undefined;
  let apply = false;
  let actionSpecified = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--mode" && !mode) {
      const value = args[++index];
      if (value !== "live" && value !== "test") throw new Error("--mode must be live or test.");
      mode = value;
    } else if ((arg === "--apply" || arg === "--dry-run") && !actionSpecified) {
      apply = arg === "--apply";
      actionSpecified = true;
    } else {
      throw new Error(`Unknown or duplicate argument: ${arg}. Use --help.`);
    }
  }
  if (!mode) throw new Error("An explicit --mode live or --mode test is required. Use --help.");
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (stripeKeyMode(key) !== mode) throw new Error("Selected mode does not match STRIPE_SECRET_KEY. No changes made.");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const database = new URL(databaseUrl);
  const catalogFile = mode === "live" ? "all_products.json" : "all_products_test.json";
  const catalogPath = path.join(__dirname, "..", "..", "prisma", "data", catalogFile);
  const catalog = readCatalogPricing(JSON.parse(fs.readFileSync(catalogPath, "utf8")));
  console.log(`${apply ? "APPLY" : "DRY-RUN"}: ${catalogFile}; database ${database.hostname}${database.pathname}`);
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000, max: 2 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia", timeout: 15_000, maxNetworkRetries: 1 });
  try {
    const records = await prisma.product.findMany({ select: productSelect, orderBy: { id: "asc" } });
    const plan = planProductPricingBackfill(catalog, records);
    console.log(`Database: ${records.length} products, ${records.reduce((sum, record) => sum + record.variants.length, 0)} variants.`);
    console.log(`To fill: ${plan.products.length} products, ${plan.variants.length} variants; ${plan.prices.length} Stripe prices to verify.`);
    for (const [label, ids] of [
      ["Database products not in catalog (skipped)", plan.skippedProducts],
      ["Database variants not in catalog (skipped)", plan.skippedVariants],
      ["Catalog products not in database (not created)", plan.missingProducts],
    ] as const) {
      if (ids.length) console.log(`${label}: ${ids.join(", ")}`);
    }
    if (!plan.products.length && !plan.variants.length) {
      console.log("Nothing to backfill. No changes made.");
      return;
    }
    console.table([...plan.products.slice(0, 3), ...plan.variants.slice(0, 3)].map((update) => ({
      id: update.id, fields: Object.keys(update.data).join(", "),
      price: update.data.priceCents === undefined ? "preserved" : `$${(update.data.priceCents / 100).toFixed(2)}`,
    })));
    for (const target of plan.prices) {
      let price: Stripe.Price;
      try {
        price = await stripe.prices.retrieve(target.stripePriceId, { expand: ["product"] });
      } catch {
        throw new Error(`Could not retrieve ${target.stripePriceId} in ${mode} mode. Confirm the API key and catalog IDs. No changes made.`);
      }
      validateCatalogStripePrice(target, price, mode);
    }
    console.log(`Verified all ${plan.prices.length} prices against Stripe in ${mode} mode (GET requests only).`);
    if (!apply) {
      console.log("Dry-run complete. No database or Stripe changes made. Rerun with --apply after reviewing the target and counts.");
      return;
    }
    // Replan inside a serializable transaction so concurrent Admin pricing edits cannot be overwritten.
    await prisma.$transaction(async (tx) => {
      const current = await tx.product.findMany({ select: productSelect, orderBy: { id: "asc" } });
      const currentPlan = planProductPricingBackfill(catalog, current);
      if (JSON.stringify(currentPlan) !== JSON.stringify(plan)) {
        throw new Error("Product pricing changed during validation. Nothing was applied; rerun the dry-run.");
      }
      for (const update of plan.products) {
        const previous = records.find((record) => record.id === update.id)!;
        const result = await tx.product.updateMany({
          where: { id: update.id, currency: previous.currency, priceCents: previous.priceCents,
            stripeProductId: previous.stripeProductId, stripeDefaultPriceId: previous.stripeDefaultPriceId },
          data: update.data,
        });
        if (result.count !== 1) throw new Error(`Concurrent pricing edit for ${update.id}; transaction rolled back.`);
      }
      for (const update of plan.variants) {
        const previous = records.find((record) => record.id === update.productId)!.variants.find((variant) => variant.id === update.id)!;
        const result = await tx.productVariant.updateMany({
          where: { id: update.id, productId: update.productId, label: previous.label,
            priceCents: previous.priceCents, stripePriceId: previous.stripePriceId },
          data: update.data,
        });
        if (result.count !== 1) throw new Error(`Concurrent pricing edit for ${update.id}; transaction rolled back.`);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    console.log(`Backfilled ${plan.products.length} products and ${plan.variants.length} variants. Stock, visibility, images and orders were not modified.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Product pricing backfill failed.");
  process.exitCode = 1;
});
