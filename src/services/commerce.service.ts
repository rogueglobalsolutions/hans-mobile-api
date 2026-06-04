import prisma from "../config/prisma";
import { stripe } from "../config/stripe";
import {
  AccountStatus,
  CommerceOrderStatus,
  CommercePaymentStatus,
  DeliveryStatus,
  FulfillmentStatus,
  OrderRefundStatus,
  OrderVerificationStatus,
  ProductStatus,
  Role,
  ShippingLabelStatus,
  ShippingMethod,
} from "../generated/prisma/enums";

type DateFilterType = "today" | "this_week";
type FilterType = "weekly" | "monthly" | "custom";

interface PaginationInput {
  page?: number;
  limit?: number;
}

interface ProductFilters extends PaginationInput {
  search?: string;
  status?: "all" | "active" | "hidden" | "out_of_stock";
  sortBy?: "name" | "price" | "stockQty" | "createdAt";
  publicOnly?: boolean;
  vendor?: string;
  category?: string;
}

interface OrderFilters extends PaginationInput {
  search?: string;
  status?: string;
  dateFilterType?: DateFilterType;
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
}

interface DateRangeInput {
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
}

interface OrderItemInput {
  productId: string;
  variantId?: string;
  quantity?: number;
}

interface CreateOrderIntentInput {
  items?: OrderItemInput[];
  productId?: string;
  variantId?: string;
  quantity?: number;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZipCode?: string;
  shippingCountry?: string;
  shippingMethod?: ShippingMethod;
  notes?: string;
}

const ORDER_NUMBER_PREFIX = "ORD";

function toDollars(cents: number | null | undefined) {
  return (cents ?? 0) / 100;
}

function fromDollars(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return null;
  return Math.round(amount * 100);
}

function normalizePage(page?: number, limit?: number) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfThisWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function dateRangeFromFilter(input: DateRangeInput = {}) {
  const now = new Date();

  if (input.filterType === "custom" && input.startDate && input.endDate) {
    return {
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    };
  }

  if (input.filterType === "monthly") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: now,
    };
  }

  return {
    startDate: startOfThisWeek(),
    endDate: now,
  };
}

function dateWhere(filters: OrderFilters) {
  if (filters.dateFilterType === "today") {
    return { gte: startOfToday() };
  }

  if (filters.dateFilterType === "this_week") {
    return { gte: startOfThisWeek() };
  }

  if (filters.startDate || filters.endDate) {
    return {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }

  return undefined;
}

function normalizeOrderStatus(status?: string): CommerceOrderStatus | null {
  if (!status || status === "all") return null;
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED") return CommerceOrderStatus.DELIVERED;
  if (normalized in CommerceOrderStatus) {
    return CommerceOrderStatus[normalized as keyof typeof CommerceOrderStatus];
  }
  return null;
}

function productDisplayStatus(product: { status: ProductStatus; stockQty: number }) {
  if (product.stockQty === 0) return "out_of_stock";
  return product.status === ProductStatus.ACTIVE ? "active" : "hidden";
}

function orderDisplayStatus(order: { status: CommerceOrderStatus; paymentStatus: CommercePaymentStatus }) {
  if (order.status === CommerceOrderStatus.DELIVERED) return "delivered";
  return order.status.toLowerCase();
}

function dashboardOrderStatus(order: { status: CommerceOrderStatus }) {
  if (order.status === CommerceOrderStatus.DELIVERED) return "COMPLETED";
  return order.status;
}

function medOrderStatus(order: { status: CommerceOrderStatus; paymentStatus: CommercePaymentStatus }) {
  if (order.paymentStatus === CommercePaymentStatus.PENDING) return "Pending Payment";
  if (order.status === CommerceOrderStatus.DELIVERED) return "Completed";
  return order.status.charAt(0) + order.status.slice(1).toLowerCase();
}

function roleToCustomerRole(role: Role) {
  const map: Record<Role, string> = {
    USER: "normal_user",
    MED: "medical_professional",
    SALES_REP: "sales_rep",
    ADMIN: "admin",
  };
  return map[role];
}

function accountStatusToDisplay(status: AccountStatus) {
  return status === AccountStatus.SUSPENDED ? "suspended" : "active";
}

function formatProduct(product: any) {
  const primaryImage = product.imageUrl || product.images?.[0]?.url || null;
  const primaryAsset = product.assetPath || product.images?.[0]?.assetPath || null;

  return {
    id: product.id,
    name: product.name,
    product_name: product.name,
    description: product.description,
    product_description: product.description,
    price: product.priceCents == null ? null : toDollars(product.priceCents),
    compareAtPrice: product.compareAtPriceCents == null ? null : toDollars(product.compareAtPriceCents),
    currency: product.currency,
    stockQty: product.stockQty,
    lowStockThreshold: product.lowStockThreshold,
    status: productDisplayStatus(product),
    category: product.category,
    vendor: product.vendor,
    sku: product.sku,
    imageUrl: primaryImage,
    assetPath: primaryAsset,
    img_path: product.assetPath,
    shipping: product.shippingInfo,
    return_and_exchange: product.returnAndExchange,
    shelf_life: product.shelfLife,
    disclaimer: product.disclaimer,
    used_with: product.usedWith,
    fda_cleared: product.fdaCleared,
    secure_packaging: product.securePackaging,
    ground_shipping_only: product.groundShippingOnly,
    stripeProductId: product.stripeProductId,
    stripeDefaultPriceId: product.stripeDefaultPriceId,
    variants: (product.variants ?? []).map((variant: any) => ({
      id: variant.id,
      variant: variant.label,
      label: variant.label,
      price: variant.priceCents == null ? null : toDollars(variant.priceCents),
      stockQty: variant.stockQty,
      sku: variant.sku,
      stripePriceId: variant.stripePriceId,
    })),
    images: product.images ?? [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function formatOrderSummary(order: any) {
  const itemCount = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) ?? 0;
  const firstItem = order.items?.[0];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
    },
    productName: firstItem?.productName ?? "Order",
    quantity: itemCount,
    items: itemCount,
    itemCount,
    totalAmount: toDollars(order.totalAmountCents),
    totalAmountCents: order.totalAmountCents,
    currency: order.currency,
    status: orderDisplayStatus(order),
    dashboardStatus: dashboardOrderStatus(order),
    medStatus: medOrderStatus(order),
    paymentStatus: order.paymentStatus.toLowerCase(),
    verificationStatus: order.verificationStatus.toLowerCase(),
    fulfillmentStatus: order.fulfillmentStatus.toLowerCase(),
    deliveryStatus: order.deliveryStatus.toLowerCase(),
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

function formatOrderDetail(order: any) {
  return {
    ...formatOrderSummary(order),
    customerPhone: order.customerPhone,
    shippingAddress: {
      address1: order.shippingAddress1,
      address2: order.shippingAddress2,
      city: order.shippingCity,
      state: order.shippingState,
      zipCode: order.shippingZipCode,
      country: order.shippingCountry,
    },
    subtotal: toDollars(order.subtotalCents),
    shippingFee: toDollars(order.shippingFeeCents),
    tax: toDollars(order.taxCents),
    notes: order.notes,
    cancellationReason: order.cancellationReason,
    cancellationNote: order.cancellationNote,
    shippingMethod: order.shippingMethod,
    courierName: order.courierName,
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: toDollars(item.unitPriceCents),
      lineTotal: toDollars(item.lineTotalCents),
    })),
    refunds: order.refunds ?? [],
    shippingLabels: order.shippingLabels ?? [],
    statusHistory: order.statusHistory ?? [],
  };
}

function buildOrderWhere(filters: OrderFilters = {}, userId?: string) {
  const status = normalizeOrderStatus(filters.status);
  const createdAt = dateWhere(filters);
  const search = filters.search?.trim();
  const isRefundedFilter = filters.status?.toLowerCase() === "refunded";

  return {
    ...(userId ? { userId } : {}),
    ...(filters.includeArchived ? {} : { archivedAt: null }),
    ...(status ? { status } : {}),
    ...(isRefundedFilter
      ? { paymentStatus: { in: [CommercePaymentStatus.REFUNDED, CommercePaymentStatus.PARTIALLY_REFUNDED] } }
      : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" as const } },
            { customerName: { contains: search, mode: "insensitive" as const } },
            { customerEmail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

async function getNextOrderNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const countToday = await prisma.order.count({ where: { createdAt: { gte: startOfToday() } } });
  return `${ORDER_NUMBER_PREFIX}-${stamp}-${String(countToday + 1).padStart(4, "0")}`;
}

async function createStatusHistory(orderId: string, updatedById: string | null, action: string, data: any = {}) {
  return prisma.orderStatusHistory.create({
    data: {
      orderId,
      updatedById,
      action,
      note: data.note ?? null,
      status: data.status,
      paymentStatus: data.paymentStatus,
      fulfillmentStatus: data.fulfillmentStatus,
      deliveryStatus: data.deliveryStatus,
      verificationStatus: data.verificationStatus,
    },
  });
}

export async function getAdminDashboard() {
  const [ordersToday, ordersThisWeek, revenueAggregate, lowStockProducts, recentOrders] = await Promise.all([
    prisma.order.count({ where: { archivedAt: null, createdAt: { gte: startOfToday() } } }),
    prisma.order.count({ where: { archivedAt: null, createdAt: { gte: startOfThisWeek() } } }),
    prisma.order.aggregate({
      where: { archivedAt: null, paymentStatus: CommercePaymentStatus.PAID },
      _sum: { totalAmountCents: true },
      _count: { id: true },
    }),
    prisma.product.findMany({
      where: { stockQty: { lte: 5 } },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
      take: 5,
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    prisma.order.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true },
    }),
  ]);

  return {
    ordersToday,
    ordersThisWeek,
    revenue: {
      totalRevenue: toDollars(revenueAggregate._sum.totalAmountCents),
      currency: "USD",
      paidOrderCount: revenueAggregate._count.id,
    },
    lowStockProducts: lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      stockQty: product.stockQty,
      imageUrl: product.imageUrl || product.images[0]?.url || undefined,
    })),
    recentOrders: recentOrders.map((order) => ({
      ...formatOrderSummary(order),
      status: dashboardOrderStatus(order),
    })),
  };
}

export async function getProducts(filters: ProductFilters = {}) {
  const { page, limit, skip } = normalizePage(filters.page, filters.limit);
  const search = filters.search?.trim();

  const baseWhere: any = {
    ...(filters.publicOnly ? { status: ProductStatus.ACTIVE } : {}),
    ...(filters.vendor ? { vendor: { equals: filters.vendor, mode: "insensitive" } } : {}),
    ...(filters.category ? { category: { equals: filters.category, mode: "insensitive" } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { vendor: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const statusWhere =
    filters.status === "active"
      ? { status: ProductStatus.ACTIVE, stockQty: { gt: 0 } }
      : filters.status === "hidden"
      ? { status: ProductStatus.HIDDEN }
      : filters.status === "out_of_stock"
      ? { stockQty: 0 }
      : {};

  const where = { ...baseWhere, ...statusWhere };
  const orderBy =
    filters.sortBy === "name"
      ? { name: "asc" as const }
      : filters.sortBy === "price"
      ? { priceCents: "desc" as const }
      : filters.sortBy === "stockQty"
      ? { stockQty: "asc" as const }
      : { createdAt: "desc" as const };

  const [items, total, all, active, hidden, outOfStock] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: baseWhere }),
    prisma.product.count({ where: { ...baseWhere, status: ProductStatus.ACTIVE, stockQty: { gt: 0 } } }),
    prisma.product.count({ where: { ...baseWhere, status: ProductStatus.HIDDEN, stockQty: { gt: 0 } } }),
    prisma.product.count({ where: { ...baseWhere, stockQty: 0 } }),
  ]);

  return {
    items: items.map(formatProduct),
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
    counts: {
      all,
      active,
      hidden,
      out_of_stock: outOfStock,
    },
  };
}

export async function getProductById(productId: string, publicOnly = false) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      ...(publicOnly ? { status: ProductStatus.ACTIVE } : {}),
    },
    include: {
      variants: { orderBy: { createdAt: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      stockAuditLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!product) throw new Error("Product not found");
  const formatted = formatProduct(product);
  const latestStock = product.stockAuditLogs[0];
  return {
    ...formatted,
    previousStockQty: latestStock?.previousStockQty ?? product.stockQty,
  };
}

export async function updateProduct(productId: string, adminId: string, input: any) {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new Error("Product not found");

  const nextStockQty = input.stockQty != null ? Number(input.stockQty) : existing.stockQty;
  const stockChanged = nextStockQty !== existing.stockQty;

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        ...(input.name != null ? { name: String(input.name).trim() } : {}),
        ...(input.description != null ? { description: String(input.description).trim() } : {}),
        ...(input.price != null ? { priceCents: fromDollars(Number(input.price)) } : {}),
        ...(input.compareAtPrice !== undefined ? { compareAtPriceCents: fromDollars(input.compareAtPrice === null || input.compareAtPrice === "" ? null : Number(input.compareAtPrice)) } : {}),
        ...(input.stockQty != null ? { stockQty: nextStockQty } : {}),
        ...(input.lowStockThreshold != null ? { lowStockThreshold: Number(input.lowStockThreshold) } : {}),
        ...(input.status != null
          ? { status: String(input.status).toLowerCase() === "hidden" ? ProductStatus.HIDDEN : ProductStatus.ACTIVE }
          : {}),
        ...(input.stripeProductId !== undefined ? { stripeProductId: input.stripeProductId || null } : {}),
        ...(input.stripeDefaultPriceId !== undefined ? { stripeDefaultPriceId: input.stripeDefaultPriceId || null } : {}),
      },
      include: {
        variants: true,
        images: { orderBy: { sortOrder: "asc" } },
        stockAuditLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (stockChanged) {
      await tx.stockAuditLog.create({
        data: {
          productId,
          previousStockQty: existing.stockQty,
          newStockQty: nextStockQty,
          delta: nextStockQty - existing.stockQty,
          note: input.adjustmentNote || input.note || null,
          adjustedById: adminId,
        },
      });
    }

    return updated;
  });

  return getProductById(product.id);
}

export async function updateProductStatus(productId: string, status: string) {
  const product = await prisma.product.update({
    where: { id: productId },
    data: { status: status.toLowerCase() === "hidden" ? ProductStatus.HIDDEN : ProductStatus.ACTIVE },
    include: { variants: true, images: { orderBy: { sortOrder: "asc" } } },
  });
  return formatProduct(product);
}

export async function updateProductStock(productId: string, adminId: string, stockQty: number, note?: string) {
  return updateProduct(productId, adminId, { stockQty, adjustmentNote: note });
}

export async function getLowStockProducts(threshold = 5) {
  const safeThreshold = Math.max(0, Number(threshold) || 5);
  const products = await prisma.product.findMany({
    where: { stockQty: { lte: safeThreshold } },
    orderBy: [{ stockQty: "asc" }, { name: "asc" }],
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  return products.map(formatProduct);
}

export async function getOrders(filters: OrderFilters = {}) {
  const { page, limit, skip } = normalizePage(filters.page, filters.limit);
  const where = buildOrderWhere(filters);
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { items: true },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: items.map(formatOrderSummary),
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
}

export async function getRecentOrders(limit = 10) {
  const orders = await prisma.order.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(1, Number(limit) || 10)),
    include: { items: true },
  });
  return orders.map(formatOrderSummary);
}

export async function getOrderCounts(dateFilterType?: DateFilterType) {
  if (dateFilterType) {
    return prisma.order.count({ where: buildOrderWhere({ dateFilterType }) });
  }

  const [ordersToday, ordersThisWeek] = await Promise.all([
    prisma.order.count({ where: buildOrderWhere({ dateFilterType: "today" }) }),
    prisma.order.count({ where: buildOrderWhere({ dateFilterType: "this_week" }) }),
  ]);
  return { ordersToday, ordersThisWeek };
}

export async function getOrderById(orderId: string, userId?: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...(userId ? { userId } : {}) },
    include: {
      items: true,
      refunds: { orderBy: { createdAt: "desc" } },
      shippingLabels: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) throw new Error("Order not found");
  return formatOrderDetail(order);
}

export async function updateOrderStatus(orderId: string, adminId: string, input: any) {
  const status = input.status ? normalizeOrderStatus(input.status) : undefined;
  const data: any = {
    ...(status ? { status } : {}),
    ...(input.fulfillmentStatus ? { fulfillmentStatus: input.fulfillmentStatus as FulfillmentStatus } : {}),
    ...(input.deliveryStatus ? { deliveryStatus: input.deliveryStatus as DeliveryStatus } : {}),
    ...(input.verificationStatus ? { verificationStatus: input.verificationStatus as OrderVerificationStatus } : {}),
  };

  if (data.status === CommerceOrderStatus.SHIPPED) data.shippedAt = new Date();
  if (data.status === CommerceOrderStatus.DELIVERED) data.deliveredAt = new Date();

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        updatedById: adminId,
        action: "status_update",
        note: input.note || null,
        status: data.status,
        fulfillmentStatus: data.fulfillmentStatus,
        deliveryStatus: data.deliveryStatus,
        verificationStatus: data.verificationStatus,
      },
    });
    return updated;
  });

  return formatOrderSummary(order);
}

export async function updateOrderTracking(orderId: string, adminId: string, input: any) {
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        trackingNumber: input.trackingNumber || null,
        courierName: input.courierName || input.carrier || null,
        trackingUrl: input.trackingUrl || null,
        ...(input.shippingMethod ? { shippingMethod: input.shippingMethod as ShippingMethod } : {}),
        deliveryStatus: input.deliveryStatus ? (input.deliveryStatus as DeliveryStatus) : DeliveryStatus.IN_TRANSIT,
      },
      include: { items: true },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        updatedById: adminId,
        action: "tracking_update",
        note: input.note || null,
        deliveryStatus: updated.deliveryStatus,
      },
    });
    return updated;
  });
  return formatOrderSummary(order);
}

export async function verifyOrder(orderId: string, adminId: string, note?: string) {
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        verificationStatus: OrderVerificationStatus.VERIFIED,
        status: CommerceOrderStatus.PROCESSING,
        verifiedAt: new Date(),
        verifiedById: adminId,
      },
      include: { items: true },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        updatedById: adminId,
        action: "verify",
        note: note || null,
        status: CommerceOrderStatus.PROCESSING,
        verificationStatus: OrderVerificationStatus.VERIFIED,
      },
    });
    return updated;
  });
  return formatOrderSummary(order);
}

export async function cancelOrder(orderId: string, adminId: string, input: any = {}) {
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: CommerceOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: input.reason || null,
        cancellationNote: input.note || null,
      },
      include: { items: true },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        updatedById: adminId,
        action: "cancel",
        note: input.note || input.reason || null,
        status: CommerceOrderStatus.CANCELLED,
      },
    });
    return updated;
  });
  return formatOrderSummary(order);
}

export async function refundOrder(orderId: string, adminId: string, input: any = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { refunds: true, items: true },
  });
  if (!order) throw new Error("Order not found");
  if (!order.stripePaymentIntentId) throw new Error("No payment found for this order");
  if (
    order.paymentStatus !== CommercePaymentStatus.PAID &&
    order.paymentStatus !== CommercePaymentStatus.PARTIALLY_REFUNDED
  ) {
    throw new Error("Order is not refundable");
  }

  const previousRefundedCents = order.refunds
    .filter((refund) => refund.status === OrderRefundStatus.SUCCEEDED)
    .reduce((sum, refund) => sum + refund.amountCents, 0);
  const remainingCents = order.totalAmountCents - previousRefundedCents;
  const requestedCents = input.amount != null ? fromDollars(Number(input.amount)) : remainingCents;
  const amountCents = Math.min(remainingCents, requestedCents ?? remainingCents);
  if (amountCents <= 0) throw new Error("Refund amount must be greater than zero");

  const stripeRefund = await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amountCents,
    reason: input.stripeReason,
  });

  const nextPaymentStatus =
    amountCents >= remainingCents ? CommercePaymentStatus.REFUNDED : CommercePaymentStatus.PARTIALLY_REFUNDED;

  await prisma.$transaction(async (tx) => {
    await tx.orderRefund.create({
      data: {
        orderId,
        amountCents,
        reason: input.reason || null,
        status: OrderRefundStatus.SUCCEEDED,
        stripeRefundId: stripeRefund.id,
        requestedById: adminId,
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: nextPaymentStatus,
        refundedAt: nextPaymentStatus === CommercePaymentStatus.REFUNDED ? new Date() : order.refundedAt,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        updatedById: adminId,
        action: "refund",
        note: input.reason || null,
        paymentStatus: nextPaymentStatus,
      },
    });
  });

  return getOrderById(orderId);
}

export async function archiveOrder(orderId: string, adminId: string, note?: string) {
  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { archivedAt: new Date() },
      include: { items: true },
    });
    await tx.orderStatusHistory.create({
      data: { orderId, updatedById: adminId, action: "archive", note: note || null },
    });
    return updated;
  });
  return formatOrderSummary(order);
}

export async function getDuplicateOrderPayload(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Order not found");
  return {
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    shippingAddress: {
      address1: order.shippingAddress1,
      address2: order.shippingAddress2,
      city: order.shippingCity,
      state: order.shippingState,
      zipCode: order.shippingZipCode,
      country: order.shippingCountry,
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  };
}

export async function getCustomers(input: PaginationInput & { search?: string; role?: string } = {}) {
  const { page, limit, skip } = normalizePage(input.page, input.limit);
  const search = input.search?.trim();
  const roleMap: Record<string, Role> = {
    normal_user: Role.USER,
    medical_professional: Role.MED,
    sales_rep: Role.SALES_REP,
    admin: Role.ADMIN,
  };
  const role = input.role && input.role !== "all" ? roleMap[input.role] : undefined;

  const where: any = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { _count: { select: { commerceOrders: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map((user) => ({
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phoneNumber,
      role: roleToCustomerRole(user.role),
      createdAt: user.createdAt,
      accountStatus: accountStatusToDisplay(user.accountStatus),
      orderCount: user._count.commerceOrders,
    })),
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
}

export async function getCustomerById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      commerceOrders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
  if (!user) throw new Error("User not found");

  const paidOrders = user.commerceOrders.filter((order) => order.paymentStatus === CommercePaymentStatus.PAID);
  const totalSpent = paidOrders.reduce((sum, order) => sum + order.totalAmountCents, 0);

  return {
    customer: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phoneNumber,
      role: roleToCustomerRole(user.role),
      accountStatus: accountStatusToDisplay(user.accountStatus),
      createdAt: user.createdAt,
    },
    totalOrders: user.commerceOrders.length,
    totalSpent: toDollars(totalSpent),
    orderHistory: user.commerceOrders.map(formatOrderSummary),
  };
}

export async function getRevenueSummary(input: DateRangeInput = {}) {
  const range = dateRangeFromFilter(input);
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: CommercePaymentStatus.PAID,
      createdAt: { gte: range.startDate, lte: range.endDate },
    },
  });

  const buckets = new Map<string, { amount: number; orderCount: number }>();
  const weekly = input.filterType !== "monthly";
  for (const order of orders) {
    const date = new Date(order.createdAt);
    const label = weekly
      ? date.toLocaleDateString("en-US", { weekday: "short" })
      : `Wk ${Math.ceil(date.getDate() / 7)}`;
    const current = buckets.get(label) ?? { amount: 0, orderCount: 0 };
    current.amount += order.totalAmountCents;
    current.orderCount += 1;
    buckets.set(label, current);
  }

  return {
    totalRevenue: toDollars(orders.reduce((sum, order) => sum + order.totalAmountCents, 0)),
    currency: "USD",
    dateRange: range,
    filterType: input.filterType ?? "weekly",
    paidOrderCount: orders.length,
    breakdown: Array.from(buckets.entries()).map(([label, data]) => ({
      label,
      amount: toDollars(data.amount),
      orderCount: data.orderCount,
    })),
  };
}

export async function getSalesReport(input: DateRangeInput = {}) {
  const range = dateRangeFromFilter(input);
  const previousStart = new Date(range.startDate);
  const previousEnd = new Date(range.endDate);
  const duration = range.endDate.getTime() - range.startDate.getTime();
  previousStart.setTime(previousStart.getTime() - duration);
  previousEnd.setTime(previousEnd.getTime() - duration);

  const [currentOrders, previousOrders] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: CommercePaymentStatus.PAID, createdAt: { gte: range.startDate, lte: range.endDate } },
    }),
    prisma.order.findMany({
      where: { paymentStatus: CommercePaymentStatus.PAID, createdAt: { gte: previousStart, lte: previousEnd } },
    }),
  ]);

  const buckets = new Map<string, { revenue: number; orderCount: number }>();
  for (const order of currentOrders) {
    const label = new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const current = buckets.get(label) ?? { revenue: 0, orderCount: 0 };
    current.revenue += order.totalAmountCents;
    current.orderCount += 1;
    buckets.set(label, current);
  }

  const totalRevenueCents = currentOrders.reduce((sum, order) => sum + order.totalAmountCents, 0);
  const previousRevenueCents = previousOrders.reduce((sum, order) => sum + order.totalAmountCents, 0);

  return {
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
    filterType: input.filterType ?? "weekly",
    totalRevenue: toDollars(totalRevenueCents),
    totalOrders: currentOrders.length,
    averageOrderValue: currentOrders.length ? toDollars(totalRevenueCents / currentOrders.length) : 0,
    salesByDay: Array.from(buckets.entries()).map(([date, data]) => ({
      date,
      revenue: toDollars(data.revenue),
      orderCount: data.orderCount,
    })),
    previousRevenue: toDollars(previousRevenueCents),
    previousOrders: previousOrders.length,
  };
}

export async function getOrdersBreakdown(input: { startDate?: string; endDate?: string } = {}) {
  const createdAt = dateWhere(input);
  const orders = await prisma.order.findMany({
    where: { ...(createdAt ? { createdAt } : {}) },
    select: { status: true, paymentStatus: true },
  });

  const statusCounts = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
  };

  for (const order of orders) {
    const key = order.status.toLowerCase() as keyof typeof statusCounts;
    statusCounts[key] += 1;
    if (
      order.paymentStatus === CommercePaymentStatus.REFUNDED ||
      order.paymentStatus === CommercePaymentStatus.PARTIALLY_REFUNDED
    ) {
      statusCounts.refunded += 1;
    }
  }

  return {
    statusCounts,
    totalOrders: orders.length,
    dateRange: input.startDate && input.endDate ? { startDate: input.startDate, endDate: input.endDate } : null,
  };
}

export async function getTopProducts(input: { sortBy?: "quantity" | "revenue"; limit?: number; startDate?: string; endDate?: string } = {}) {
  const createdAt = dateWhere(input);
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        paymentStatus: CommercePaymentStatus.PAID,
        ...(createdAt ? { createdAt } : {}),
      },
    },
    include: {
      product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
    },
  });

  const grouped = new Map<string, any>();
  for (const item of items) {
    const key = item.productId ?? item.productName;
    const current = grouped.get(key) ?? {
      productId: item.productId,
      productName: item.productName,
      imageUrl: item.product?.imageUrl || item.product?.images[0]?.url || undefined,
      quantitySold: 0,
      totalRevenue: 0,
      category: item.product?.category ?? "",
    };
    current.quantitySold += item.quantity;
    current.totalRevenue += item.lineTotalCents;
    grouped.set(key, current);
  }

  const sortBy = input.sortBy ?? "quantity";
  return Array.from(grouped.values())
    .sort((a, b) => (sortBy === "revenue" ? b.totalRevenue - a.totalRevenue : b.quantitySold - a.quantitySold))
    .slice(0, Math.min(50, Math.max(1, Number(input.limit) || 10)))
    .map((product) => ({ ...product, totalRevenue: toDollars(product.totalRevenue) }));
}

export async function getShippingLabels(input: PaginationInput & { status?: string; carrier?: string; startDate?: string; endDate?: string } = {}) {
  const { page, limit, skip } = normalizePage(input.page, input.limit);
  const createdAt = dateWhere(input);
  const where: any = {
    ...(input.status && input.status !== "all" ? { status: input.status as ShippingLabelStatus } : {}),
    ...(input.carrier ? { carrier: { equals: input.carrier, mode: "insensitive" } } : {}),
    ...(createdAt ? { createdAt } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.shippingLabel.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { order: { include: { items: true } } },
    }),
    prisma.shippingLabel.count({ where }),
  ]);

  return {
    items: items.map((label) => ({
      id: label.id,
      orderId: label.orderId,
      orderNumber: label.order.orderNumber,
      customerName: label.order.customerName,
      items: label.order.items.reduce((sum, item) => sum + item.quantity, 0),
      cost: label.costCents == null ? null : toDollars(label.costCents),
      currency: label.currency,
      status: label.status.toLowerCase(),
      shippingMethod: label.shippingMethod,
      carrier: label.carrier,
      trackingNumber: label.trackingNumber,
      trackingUrl: label.trackingUrl,
      labelUrl: label.labelUrl,
      deliveryStatus: label.order.deliveryStatus.toLowerCase(),
      printedAt: label.printedAt,
      createdAt: label.createdAt,
    })),
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
}

export async function getShippingLabelById(labelId: string) {
  const label = await prisma.shippingLabel.findUnique({
    where: { id: labelId },
    include: { order: { include: { items: true } } },
  });
  if (!label) throw new Error("Shipping label not found");
  return {
    id: label.id,
    orderId: label.orderId,
    orderNumber: label.order.orderNumber,
    customerName: label.order.customerName,
    items: label.order.items.reduce((sum, item) => sum + item.quantity, 0),
    cost: label.costCents == null ? null : toDollars(label.costCents),
    currency: label.currency,
    status: label.status.toLowerCase(),
    shippingMethod: label.shippingMethod,
    carrier: label.carrier,
    serviceCode: label.serviceCode,
    trackingNumber: label.trackingNumber,
    trackingUrl: label.trackingUrl,
    labelUrl: label.labelUrl,
    labelFormat: label.labelFormat,
    shipmentId: label.shipmentId,
    rateId: label.rateId,
    deliveryStatus: label.order.deliveryStatus.toLowerCase(),
    printedAt: label.printedAt,
    voidedAt: label.voidedAt,
    createdAt: label.createdAt,
  };
}

export async function createShippingLabel(orderId: string, adminId: string, input: any) {
  const label = await prisma.$transaction(async (tx) => {
    const created = await tx.shippingLabel.create({
      data: {
        orderId,
        status: input.status ? (input.status as ShippingLabelStatus) : ShippingLabelStatus.CREATED,
        shippingMethod: input.shippingMethod as ShippingMethod | undefined,
        carrier: input.carrier || "UPS",
        serviceCode: input.serviceCode || null,
        trackingNumber: input.trackingNumber || null,
        trackingUrl: input.trackingUrl || null,
        labelUrl: input.labelUrl || null,
        labelFormat: input.labelFormat || null,
        shipmentId: input.shipmentId || null,
        rateId: input.rateId || null,
        costCents: input.cost != null ? fromDollars(Number(input.cost)) : null,
        requestedById: adminId,
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: DeliveryStatus.LABEL_CREATED,
        trackingNumber: input.trackingNumber || undefined,
        trackingUrl: input.trackingUrl || undefined,
        courierName: input.carrier || "UPS",
        shippingMethod: input.shippingMethod as ShippingMethod | undefined,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        updatedById: adminId,
        action: "shipping_label_create",
        deliveryStatus: DeliveryStatus.LABEL_CREATED,
      },
    });
    return created;
  });
  return label;
}

export async function markShippingLabelPrinted(labelId: string, adminId: string) {
  const label = await prisma.shippingLabel.update({
    where: { id: labelId },
    data: { status: ShippingLabelStatus.PRINTED, printedAt: new Date() },
  });
  await createStatusHistory(label.orderId, adminId, "shipping_label_printed");
  return label;
}

export async function voidShippingLabel(labelId: string, adminId: string) {
  const label = await prisma.shippingLabel.update({
    where: { id: labelId },
    data: { status: ShippingLabelStatus.VOIDED, voidedAt: new Date() },
  });
  await createStatusHistory(label.orderId, adminId, "shipping_label_voided");
  return label;
}

export async function createProductOrderIntent(userId: string, input: CreateOrderIntentInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const requestedItems = input.items?.length
    ? input.items
    : input.productId
    ? [{ productId: input.productId, variantId: input.variantId, quantity: input.quantity }]
    : [];

  if (requestedItems.length === 0) throw new Error("At least one product is required");

  const orderItems = [];
  let subtotalCents = 0;

  for (const requested of requestedItems) {
    const quantity = Math.max(1, Number(requested.quantity) || 1);
    const product = await prisma.product.findFirst({
      where: { id: requested.productId, status: ProductStatus.ACTIVE },
      include: { variants: true },
    });
    if (!product) throw new Error("Product not found");
    if (product.stockQty < quantity) throw new Error("Product is out of stock");

    const variant = requested.variantId
      ? product.variants.find((item) => item.id === requested.variantId)
      : product.variants[0] ?? null;
    const stripePriceId = variant?.stripePriceId || product.stripeDefaultPriceId;
    if (!stripePriceId) throw new Error("Product checkout is not configured");

    const stripePrice = await stripe.prices.retrieve(stripePriceId);
    if (!stripePrice.active) throw new Error("Product checkout is not configured");
    if (stripePrice.type !== "one_time") throw new Error("Product checkout is not configured");
    if (stripePrice.currency.toLowerCase() !== "usd") throw new Error("Product checkout is not configured");
    if (stripePrice.unit_amount == null) throw new Error("Product checkout is not configured");

    const unitPriceCents = stripePrice.unit_amount;
    const lineTotalCents = unitPriceCents * quantity;
    subtotalCents += lineTotalCents;
    orderItems.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      productName: product.name,
      variantLabel: variant?.label ?? null,
      sku: variant?.sku ?? product.sku,
      quantity,
      unitPriceCents,
      lineTotalCents,
    });
  }

  const orderNumber = await getNextOrderNumber();
  const totalAmountCents = subtotalCents;
  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId,
      customerName: user.fullName,
      customerEmail: user.email,
      customerPhone: user.phoneNumber,
      shippingAddress1: input.shippingAddress1 ?? user.practiceAddressLine1 ?? user.address ?? null,
      shippingAddress2: input.shippingAddress2 ?? user.practiceAddressLine2 ?? null,
      shippingCity: input.shippingCity ?? user.practiceCity ?? user.city ?? null,
      shippingState: input.shippingState ?? user.practiceState ?? user.stateProvince ?? null,
      shippingZipCode: input.shippingZipCode ?? user.practiceZipCode ?? user.zipCode ?? null,
      shippingCountry: input.shippingCountry ?? user.practiceCountry ?? user.country ?? null,
      shippingMethod: input.shippingMethod,
      subtotalCents,
      totalAmountCents,
      notes: input.notes ?? null,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "usd",
      metadata: { orderId: order.id, orderNumber: order.orderNumber, userId },
      payment_method_types: ["card"],
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountUsd: toDollars(totalAmountCents),
    };
  } catch (error) {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
    throw error;
  }
}

export async function confirmProductOrderPayment(userId: string, paymentIntentId: string) {
  const order = await prisma.order.findFirst({
    where: { userId, stripePaymentIntentId: paymentIntentId },
    include: { items: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus === CommercePaymentStatus.PAID) {
    return { message: "Already confirmed", alreadyConfirmed: true, order: formatOrderSummary(order) };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") throw new Error("Payment has not succeeded");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: CommercePaymentStatus.PAID,
        status: CommerceOrderStatus.PROCESSING,
        paidAt: new Date(),
      },
    });

    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }
      if (item.variantId) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (variant?.stockQty != null) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQty: { decrement: item.quantity } },
          });
        }
      }
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        updatedById: userId,
        action: "payment_confirmed",
        status: CommerceOrderStatus.PROCESSING,
        paymentStatus: CommercePaymentStatus.PAID,
      },
    });
  });

  return { message: "Order payment confirmed", alreadyConfirmed: false, order: await getOrderById(order.id, userId) };
}

export async function getMyOrders(userId: string, status?: string) {
  const filters: OrderFilters = {};
  if (status) {
    const normalized = status.toLowerCase();
    if (normalized === "pending payment") {
      filters.status = "pending";
    } else if (normalized === "completed") {
      filters.status = "delivered";
    } else {
      filters.status = normalized;
    }
  }

  const orders = await prisma.order.findMany({
    where: buildOrderWhere(filters, userId),
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return orders.map((order) => ({
    ...formatOrderSummary(order),
    status: medOrderStatus(order),
    totalAmount: `$${toDollars(order.totalAmountCents).toFixed(2)}`,
    date: order.createdAt,
  }));
}
