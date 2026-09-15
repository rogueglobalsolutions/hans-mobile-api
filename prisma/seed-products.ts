import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ProductStatus } from "../src/generated/prisma/enums";
import "../src/config/env";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const VENDOR_SLUGS: Record<string, string> = {
  MINT: "mint",
  klárdie: "klardie",
  "EZ-Tcon": "ez-tcon",
  "MicronJet™": "micronjet",
  "Lumina Pin™": "lumina",
  TargetCool: "targetcool",
};

const SKIPPED_KEYS = new Set(["EZ-Tcon", "TargetCool", "_commented_out"]);

function sanitizeValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "nan") return null;
  return text;
}

function toSlug(vendor: string, productName: string): string {
  const vendorSlug = VENDOR_SLUGS[vendor] || vendor.toLowerCase();
  const productSlug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${vendorSlug}_${productSlug}`;
}

function toCents(value: unknown): number | null {
  const sanitized = sanitizeValue(value);
  if (!sanitized) return null;
  const numeric = Number(sanitized);
  if (Number.isNaN(numeric)) return null;
  return Math.round(numeric * 100);
}

async function main() {
  const catalogFile = process.env.PRODUCT_CATALOG_FILE ||
    (process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "all_products_test.json" : "all_products.json");
  const dataPath = path.join(__dirname, "data", catalogFile);
  if (!fs.existsSync(dataPath)) throw new Error(`Product catalog not found: ${catalogFile}`);
  const rawData = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Record<string, any>;

  let productCount = 0;
  let variantCount = 0;

  for (const [vendorName, rawProducts] of Object.entries(rawData)) {
    if (SKIPPED_KEYS.has(vendorName)) continue;
    if (!Array.isArray(rawProducts)) continue;

    const productGroups = new Map<string, any[]>();
    for (const raw of rawProducts) {
      const name = sanitizeValue(raw.product_name);
      if (!name) continue;
      if (!productGroups.has(name)) productGroups.set(name, []);
      productGroups.get(name)!.push(raw);
    }

    for (const [productName, variants] of productGroups) {
      const first = variants[0];
      const id = toSlug(vendorName, productName);
      const firstPriceCents = toCents(first.product_price);
      const assetPath = sanitizeValue(first.img_path);
      const stripeProductId = sanitizeValue(first.stripeProductId);
      const stripeDefaultPriceId = sanitizeValue(first.stripePriceId);

      await prisma.product.upsert({
        where: { id },
        create: {
          id,
          slug: id,
          name: productName,
          description: sanitizeValue(first.product_description) ?? "",
          vendor: vendorName,
          category: vendorName,
          priceCents: firstPriceCents,
          currency: "USD",
          stockQty: 0,
          lowStockThreshold: 5,
          status: ProductStatus.HIDDEN,
          assetPath,
          shippingInfo: sanitizeValue(first.shipping),
          returnAndExchange: sanitizeValue(first.return_and_exchange),
          shelfLife: sanitizeValue(first.shelf_life),
          disclaimer: sanitizeValue(first.disclaimer),
          usedWith: sanitizeValue(first.used_with),
          fdaCleared: sanitizeValue(first.fda_cleared) === "yes",
          securePackaging: sanitizeValue(first.secure_packaging) === "yes",
          groundShippingOnly: sanitizeValue(first.ground_shipping_only) === "yes",
          stripeProductId,
          stripeDefaultPriceId,
          images: assetPath
            ? {
                create: {
                  assetPath,
                  altText: productName,
                  sortOrder: 0,
                },
              }
            : undefined,
          variants: {
            create: variants.map((variant, index) => ({
              label: sanitizeValue(variant.variant) ?? "Default",
              priceCents: toCents(variant.product_price),
              stockQty: null,
              stripePriceId: sanitizeValue(variant.stripePriceId),
              createdAt: new Date(Date.now() + index),
            })),
          },
        },
        update: {
          name: productName,
          description: sanitizeValue(first.product_description) ?? "",
          vendor: vendorName,
          category: vendorName,
          priceCents: firstPriceCents,
          assetPath,
          shippingInfo: sanitizeValue(first.shipping),
          returnAndExchange: sanitizeValue(first.return_and_exchange),
          shelfLife: sanitizeValue(first.shelf_life),
          disclaimer: sanitizeValue(first.disclaimer),
          usedWith: sanitizeValue(first.used_with),
          fdaCleared: sanitizeValue(first.fda_cleared) === "yes",
          securePackaging: sanitizeValue(first.secure_packaging) === "yes",
          groundShippingOnly: sanitizeValue(first.ground_shipping_only) === "yes",
          stripeProductId,
          stripeDefaultPriceId,
        },
      });

      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (assetPath) {
        await prisma.productImage.create({
          data: {
            productId: id,
            assetPath,
            altText: productName,
            sortOrder: 0,
          },
        });
      }

      const existingVariants = await prisma.productVariant.findMany({ where: { productId: id } });
      const desiredLabels = variants.map((variant) => sanitizeValue(variant.variant) ?? "Default");

      for (const variant of variants) {
        const label = sanitizeValue(variant.variant) ?? "Default";
        const existingVariant = existingVariants.find((item) => item.label === label);
        const data = {
          label,
          priceCents: toCents(variant.product_price),
          stripePriceId: sanitizeValue(variant.stripePriceId),
        };
        if (existingVariant) {
          await prisma.productVariant.update({ where: { id: existingVariant.id }, data });
        } else {
          await prisma.productVariant.create({ data: { productId: id, stockQty: null, ...data } });
        }
      }

      await prisma.productVariant.deleteMany({
        where: { productId: id, label: { notIn: desiredLabels } },
      });

      productCount += 1;
      variantCount += variants.length;
    }
  }

  console.log(`Seeded ${productCount} products and ${variantCount} variants from ${catalogFile}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
