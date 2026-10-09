import prisma from "../config/prisma";

const MAX_CART_LINES = 100;

interface CartLine {
  productId: string;
  variantId: string | null;
  variantLabel: string | null;
  productName: string;
  unitPrice: number | null;
  quantity: number;
}

function cleanLine(raw: any): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const productId = typeof raw.productId === "string" ? raw.productId.trim() : "";
  const quantity = Math.floor(Number(raw.quantity));
  if (!productId || !Number.isFinite(quantity) || quantity < 1) return null;
  const unitPrice = raw.unitPrice == null ? null : Number(raw.unitPrice);

  return {
    productId,
    variantId: typeof raw.variantId === "string" && raw.variantId ? raw.variantId : null,
    variantLabel: typeof raw.variantLabel === "string" ? raw.variantLabel.slice(0, 120) : null,
    productName: typeof raw.productName === "string" ? raw.productName.slice(0, 200) : "Product",
    unitPrice: unitPrice != null && Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : null,
    quantity: Math.min(quantity, 999),
  };
}

/** Mirrors the on-device cart so admins can see abandoned carts. An empty cart clears the record. */
export async function syncCart(userId: string, rawItems: unknown) {
  if (!Array.isArray(rawItems)) throw new Error("Cart items must be a list");
  const items = rawItems.slice(0, MAX_CART_LINES).map(cleanLine).filter((line): line is CartLine => !!line);

  if (!items.length) {
    await prisma.cart.deleteMany({ where: { userId } });
    return { itemCount: 0, subtotal: 0 };
  }

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalCents = items.reduce(
    (sum, line) => sum + Math.round((line.unitPrice ?? 0) * 100) * line.quantity,
    0,
  );

  await prisma.cart.upsert({
    where: { userId },
    create: { userId, items: items as any, itemCount, subtotalCents },
    update: { items: items as any, itemCount, subtotalCents },
  });

  return { itemCount, subtotal: subtotalCents / 100 };
}

/** Carts that have sat untouched for at least `idleHours`, newest first. */
export async function getAbandonedCarts(idleHours = 24) {
  const hours = Number.isFinite(idleHours) && idleHours >= 0 ? idleHours : 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const carts = await prisma.cart.findMany({
    where: { updatedAt: { lte: cutoff }, itemCount: { gt: 0 } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true, profilePicturePath: true } },
    },
  });

  return carts.map((cart) => ({
    id: cart.id,
    user: cart.user,
    items: cart.items,
    itemCount: cart.itemCount,
    subtotal: cart.subtotalCents / 100,
    updatedAt: cart.updatedAt,
  }));
}
