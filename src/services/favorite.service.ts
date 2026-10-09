import prisma from "../config/prisma";
import { ProductStatus } from "../generated/prisma/enums";
import { formatProduct } from "./commerce.service";

/** The user's hearted products that are still for sale, most recently added first. */
export async function getFavorites(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId, product: { status: ProductStatus.ACTIVE } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          variants: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          images: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  return favorites.map((favorite) => ({
    ...formatProduct(favorite.product),
    favoritedAt: favorite.createdAt,
  }));
}

export async function getFavoriteIds(userId: string) {
  const favorites = await prisma.favorite.findMany({ where: { userId }, select: { productId: true } });
  return favorites.map((favorite) => favorite.productId);
}

export async function addFavorite(userId: string, productId: unknown) {
  if (typeof productId !== "string" || !productId) throw new Error("Product is required");
  const product = await prisma.product.findFirst({
    where: { id: productId, status: ProductStatus.ACTIVE },
    select: { id: true },
  });
  if (!product) throw new Error("Product not found");

  await prisma.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
}

export async function removeFavorite(userId: string, productId: string) {
  await prisma.favorite.deleteMany({ where: { userId, productId } });
}
