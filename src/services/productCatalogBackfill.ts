export type CatalogMode = "live" | "test";

export interface CatalogVariantPricing {
  label: string;
  priceCents: number;
  stripeProductId: string;
  stripePriceId: string;
}

export interface CatalogProductPricing {
  id: string;
  name: string;
  variants: CatalogVariantPricing[];
}

export interface ProductPricingRecord {
  id: string;
  currency: string;
  priceCents: number | null;
  stripeProductId: string | null;
  stripeDefaultPriceId: string | null;
  variants: Array<{
    id: string;
    label: string;
    priceCents: number | null;
    stripePriceId: string | null;
  }>;
}

export interface ProductPricingBackfillPlan {
  products: Array<{
    id: string;
    data: { priceCents?: number; stripeProductId?: string; stripeDefaultPriceId?: string };
  }>;
  variants: Array<{
    id: string;
    productId: string;
    data: { priceCents?: number; stripePriceId?: string };
  }>;
  prices: CatalogVariantPricing[];
  skippedProducts: string[];
  skippedVariants: string[];
  missingProducts: string[];
}

const VENDOR_SLUGS: Record<string, string> = {
  MINT: "mint", "klárdie": "klardie", "EZ-Tcon": "ez-tcon",
  "MicronJet™": "micronjet", "Lumina Pin™": "lumina", TargetCool: "targetcool",
};
const SKIPPED_VENDORS = new Set(["EZ-Tcon", "TargetCool", "_commented_out"]);

function text(value: unknown): string {
  if (value == null) return "";
  const result = String(value).trim();
  return result.toLowerCase() === "nan" ? "" : result;
}

export function stripeKeyMode(key: string): CatalogMode {
  if (/^(sk|rk)_live_/.test(key)) return "live";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  throw new Error("STRIPE_SECRET_KEY must be a Stripe secret or restricted API key.");
}

export function readCatalogPricing(raw: unknown): CatalogProductPricing[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid product catalog.");
  }
  const products = new Map<string, CatalogProductPricing>();
  for (const [vendor, rows] of Object.entries(raw)) {
    if (SKIPPED_VENDORS.has(vendor) || !Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") throw new Error(`Invalid catalog row in ${vendor}.`);
      const name = text(row.product_name);
      if (!name) throw new Error(`Missing product name in ${vendor}.`);
      // Match the stable IDs and variant labels used by seed-products.ts, not editable DB names.
      const id = `${VENDOR_SLUGS[vendor] || vendor.toLowerCase()}_${name.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
      const amount = text(row.product_price);
      const priceCents = Math.round(Number(amount) * 100);
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isSafeInteger(priceCents) || priceCents > 2_147_483_647) {
        throw new Error(`Invalid catalog price for ${id}.`);
      }
      const stripeProductId = text(row.stripeProductId);
      const stripePriceId = text(row.stripePriceId);
      if (!/^prod_[A-Za-z0-9]+$/.test(stripeProductId) || !/^price_[A-Za-z0-9]+$/.test(stripePriceId)) {
        throw new Error(`Missing or invalid Stripe mapping for ${id}.`);
      }
      const product = products.get(id) || { id, name, variants: [] };
      if (product.name !== name) throw new Error(`Ambiguous catalog product ID: ${id}.`);
      const label = text(row.variant) || "Default";
      if (product.variants.some((variant) => variant.label === label)) {
        throw new Error(`Duplicate catalog variant: ${id} / ${label}.`);
      }
      if (product.variants.some((variant) => variant.stripeProductId !== stripeProductId)) {
        throw new Error(`Inconsistent Stripe product mapping for ${id}.`);
      }
      product.variants.push({ label, priceCents, stripeProductId, stripePriceId });
      products.set(id, product);
    }
  }
  if (!products.size) throw new Error("Product catalog is empty.");
  return [...products.values()];
}

function preserveOrFill<T>(existing: T | null, catalog: T, field: string, id: string): T | undefined {
  if (existing === null) return catalog;
  if (existing !== catalog) {
    throw new Error(`Cannot repair incomplete ${id}: existing ${field} conflicts with the catalog. Review in Admin first.`);
  }
  return undefined;
}

export function planProductPricingBackfill(
  catalog: CatalogProductPricing[], records: ProductPricingRecord[],
): ProductPricingBackfillPlan {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const existingIds = new Set(records.map((product) => product.id));
  const prices = new Map<string, CatalogVariantPricing>();
  const plan: ProductPricingBackfillPlan = {
    products: [], variants: [], prices: [], skippedProducts: [], skippedVariants: [],
    missingProducts: catalog.filter((product) => !existingIds.has(product.id)).map((product) => product.id),
  };
  const verifyPrice = (price: CatalogVariantPricing) => {
    const previous = prices.get(price.stripePriceId);
    if (previous && (previous.priceCents !== price.priceCents || previous.stripeProductId !== price.stripeProductId)) {
      throw new Error(`Inconsistent catalog price: ${price.stripePriceId}.`);
    }
    prices.set(price.stripePriceId, price);
  };
  for (const record of records) {
    const product = byId.get(record.id);
    if (!product) { plan.skippedProducts.push(record.id); continue; }
    const first = product.variants[0]!;
    const productIncomplete = record.priceCents === null || record.stripeProductId === null || record.stripeDefaultPriceId === null;
    const variantsIncomplete = record.variants.some((variant) => variant.priceCents === null || variant.stripePriceId === null);
    if ((productIncomplete || variantsIncomplete) && record.currency !== "USD") {
      throw new Error(`Cannot repair ${record.id}: currency is not USD.`);
    }
    if (productIncomplete) {
      const data = {
        priceCents: preserveOrFill(record.priceCents, first.priceCents, "priceCents", record.id),
        stripeProductId: preserveOrFill(record.stripeProductId, first.stripeProductId, "stripeProductId", record.id),
        stripeDefaultPriceId: preserveOrFill(record.stripeDefaultPriceId, first.stripePriceId, "stripeDefaultPriceId", record.id),
      };
      plan.products.push({ id: record.id, data: Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) });
      verifyPrice(first);
    }
    const labels = new Set<string>();
    for (const variant of record.variants) {
      if (labels.has(variant.label)) throw new Error(`Duplicate database variant: ${record.id} / ${variant.label}.`);
      labels.add(variant.label);
      const target = product.variants.find((item) => item.label === variant.label);
      if (!target) { plan.skippedVariants.push(variant.id); continue; }
      if (variant.priceCents !== null && variant.stripePriceId !== null) continue;
      if (record.stripeProductId !== null && record.stripeProductId !== target.stripeProductId) {
        throw new Error(`Cannot repair ${variant.id}: parent Stripe product conflicts with the catalog.`);
      }
      const data = {
        priceCents: preserveOrFill(variant.priceCents, target.priceCents, "priceCents", variant.id),
        stripePriceId: preserveOrFill(variant.stripePriceId, target.stripePriceId, "stripePriceId", variant.id),
      };
      plan.variants.push({ id: variant.id, productId: record.id,
        data: Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) });
      verifyPrice(target);
    }
  }
  plan.prices = [...prices.values()];
  return plan;
}

export interface RetrievedStripePrice {
  id: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  type: string;
  billing_scheme: string;
  unit_amount: number | null;
  product: string | { id: string; deleted?: boolean | void; active?: boolean };
}

export function validateCatalogStripePrice(
  target: CatalogVariantPricing, price: RetrievedStripePrice, mode: CatalogMode,
): void {
  const product = typeof price.product === "string" ? { id: price.product } : price.product;
  if (price.id !== target.stripePriceId || price.livemode !== (mode === "live") || !price.active ||
      price.currency !== "usd" || price.type !== "one_time" || price.billing_scheme !== "per_unit" ||
      price.unit_amount !== target.priceCents || product.id !== target.stripeProductId ||
      product.deleted || product.active === false) {
    throw new Error(`Stripe validation failed for ${target.stripePriceId}: mode, product, currency, amount or active status does not match the catalog.`);
  }
}
