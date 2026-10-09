import prisma from "../config/prisma";
import {
  AccountStatus,
  CommerceOrderStatus,
  CommercePaymentStatus,
  DraftOrderStatus,
  ProductStatus,
  Role,
  ShippingMethod,
} from "../generated/prisma/enums";
import * as commerceService from "./commerce.service";
import { sendInvoiceEmail } from "./email.service";
import { sanitizeError } from "../utils/errors";

export interface DraftActor {
  id: string;
  role: Role;
}

interface DraftItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface DraftOrderInput {
  customerId?: string;
  items?: DraftItemInput[];
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZipCode?: string | null;
  shippingCountry?: string | null;
  shippingMethod?: string;
  notes?: string | null;
}

const DRAFT_NUMBER_PREFIX = "D";
const MAX_ITEMS = 50;
const MAX_QUANTITY = 999;
const DRAFT_SHIPPING_METHODS: ShippingMethod[] = [ShippingMethod.GROUND, ShippingMethod.SECOND_DAY_AIR];

const toDollars = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

function cleanText(value: unknown, max = 200) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function scopeFor(actor: DraftActor) {
  // Sales reps work only with the drafts they created; admins see every draft.
  return actor.role === Role.ADMIN ? {} : { createdById: actor.id };
}

async function nextDraftNumber() {
  const last = await prisma.draftOrder.findFirst({
    where: { draftNumber: { startsWith: `${DRAFT_NUMBER_PREFIX}-` } },
    orderBy: { draftNumber: "desc" },
    select: { draftNumber: true },
  });
  const sequence = Number(last?.draftNumber.split("-").at(-1)) || 1000;
  return `${DRAFT_NUMBER_PREFIX}-${String(sequence + 1).padStart(5, "0")}`;
}

async function requireCustomer(customerId: string | undefined) {
  if (!customerId) throw new Error("Choose a medical professional for this order");
  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  if (!customer || customer.role !== Role.MED) throw new Error("Customer must be a medical professional");
  if (customer.accountStatus !== AccountStatus.ACTIVE) throw new Error("This medical professional's account is not active");
  return customer;
}

async function normalizeItems(items: DraftItemInput[] | undefined) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Add at least one product");
  if (items.length > MAX_ITEMS) throw new Error(`A draft can hold at most ${MAX_ITEMS} lines`);

  const normalized = items.map((item, index) => {
    const quantity = Math.floor(Number(item.quantity));
    if (!item.productId || typeof item.productId !== "string") throw new Error("Each line needs a product");
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new Error(`Quantity must be between 1 and ${MAX_QUANTITY}`);
    }
    return { productId: item.productId, variantId: item.variantId || null, quantity, sortOrder: index };
  });

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(normalized.map((item) => item.productId))] } },
    include: { variants: { select: { id: true } } },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  for (const item of normalized) {
    const product = byId.get(item.productId);
    if (!product) throw new Error("A selected product no longer exists");
    if (item.variantId && !product.variants.some((variant) => variant.id === item.variantId)) {
      throw new Error(`The selected option for ${product.name} no longer exists`);
    }
  }
  return normalized;
}

function shippingFields(input: DraftOrderInput, fallback?: Record<string, string | null>) {
  const pick = (key: keyof DraftOrderInput, fallbackKey: string) =>
    key in input ? cleanText(input[key]) : (fallback?.[fallbackKey] ?? null);
  const method = (input.shippingMethod ?? ShippingMethod.GROUND) as ShippingMethod;
  if (!DRAFT_SHIPPING_METHODS.includes(method)) throw new Error("Unsupported shipping method");
  return {
    shippingAddress1: pick("shippingAddress1", "address1"),
    shippingAddress2: pick("shippingAddress2", "address2"),
    shippingCity: pick("shippingCity", "city"),
    shippingState: pick("shippingState", "state"),
    shippingZipCode: pick("shippingZipCode", "zipCode"),
    shippingCountry: pick("shippingCountry", "country"),
    shippingMethod: method,
  };
}

function practiceAddress(customer: any) {
  return {
    address1: customer.practiceAddressLine1 ?? customer.address ?? null,
    address2: customer.practiceAddressLine2 ?? null,
    city: customer.practiceCity ?? customer.city ?? null,
    state: customer.practiceState ?? customer.stateProvince ?? null,
    zipCode: customer.practiceZipCode ?? customer.zipCode ?? null,
    country: customer.practiceCountry ?? customer.country ?? null,
  };
}

function checkoutInput(draft: {
  items: { productId: string; variantId: string | null; quantity: number }[];
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZipCode: string | null;
  shippingCountry: string | null;
  shippingMethod: ShippingMethod;
  notes: string | null;
}) {
  return {
    items: draft.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      quantity: item.quantity,
    })),
    shippingAddress1: draft.shippingAddress1 ?? undefined,
    shippingAddress2: draft.shippingAddress2 ?? undefined,
    shippingCity: draft.shippingCity ?? undefined,
    shippingState: draft.shippingState ?? undefined,
    shippingZipCode: draft.shippingZipCode ?? undefined,
    shippingCountry: draft.shippingCountry ?? undefined,
    shippingMethod: draft.shippingMethod,
    notes: draft.notes ?? undefined,
    applyCredits: false,
  };
}

/** Prices a draft exactly as checkout would. Returns an error message instead of throwing. */
async function quoteSafely(customerId: string, draft: Parameters<typeof checkoutInput>[0]) {
  try {
    const quote = await commerceService.quoteProductOrder(customerId, checkoutInput(draft));
    return { quote, quoteError: null as string | null };
  } catch (error) {
    return { quote: null, quoteError: sanitizeError(error, "quoteDraftOrder") };
  }
}

const DRAFT_INCLUDE = {
  customer: {
    select: {
      id: true, fullName: true, email: true, phoneNumber: true, practiceName: true,
      practiceAddressLine1: true, practiceAddressLine2: true, practiceCity: true, practiceState: true,
      practiceZipCode: true, practiceCountry: true, address: true, city: true, stateProvince: true,
      zipCode: true, country: true,
    },
  },
  createdBy: { select: { id: true, fullName: true, role: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
  order: {
    select: {
      id: true, orderNumber: true, status: true, paymentStatus: true, paidAt: true,
      items: { select: { productId: true, variantId: true, unitPriceCents: true } },
    },
  },
};

function displayStatus(draft: any) {
  if (draft.status === DraftOrderStatus.CANCELLED) return "cancelled";
  if (draft.status === DraftOrderStatus.OPEN) return "open";
  if (draft.order?.paymentStatus === CommercePaymentStatus.PAID) return "paid";
  if (draft.order?.status === CommerceOrderStatus.CANCELLED) return "cancelled";
  if (draft.checkoutExpiresAt && new Date(draft.checkoutExpiresAt) < new Date()) return "link_expired";
  return "link_sent";
}

async function formatDrafts(drafts: any[]) {
  const productIds = [...new Set(drafts.flatMap((draft) => draft.items.map((item: any) => item.productId)))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { variants: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      })
    : [];
  const byId = new Map(products.map((product) => [product.id, product]));

  return drafts.map((draft) => {
    const items = draft.items.map((item: any) => {
      const product = byId.get(item.productId);
      const variant = item.variantId ? product?.variants.find((v) => v.id === item.variantId) : null;
      // Once sent, the order holds the price actually charged; before that, the catalog price.
      const charged = draft.order?.items.find(
        (orderItem: any) => orderItem.productId === item.productId && orderItem.variantId === item.variantId,
      );
      const unitCents = charged?.unitPriceCents ?? variant?.priceCents ?? product?.priceCents ?? null;
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        productName: product?.name ?? "Unavailable product",
        variantLabel: variant?.label ?? null,
        sku: variant?.sku ?? product?.sku ?? null,
        imageUrl: product ? commerceService.formatProduct(product).imageUrl : null,
        unitPrice: toDollars(unitCents),
        lineTotal: unitCents == null ? null : (unitCents * item.quantity) / 100,
        available: product ? (variant?.stockQty ?? product.stockQty) : 0,
        productActive: product?.status === ProductStatus.ACTIVE,
      };
    });
    return {
      id: draft.id,
      draftNumber: draft.draftNumber,
      status: displayStatus(draft),
      customer: {
        id: draft.customer.id,
        name: draft.customer.fullName,
        email: draft.customer.email,
        phone: draft.customer.phoneNumber,
        practiceName: draft.customer.practiceName,
        practiceAddress: practiceAddress(draft.customer),
      },
      createdBy: { id: draft.createdBy.id, name: draft.createdBy.fullName, role: draft.createdBy.role },
      items,
      itemCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      shippingAddress: {
        address1: draft.shippingAddress1,
        address2: draft.shippingAddress2,
        city: draft.shippingCity,
        state: draft.shippingState,
        zipCode: draft.shippingZipCode,
        country: draft.shippingCountry,
      },
      shippingMethod: draft.shippingMethod,
      notes: draft.notes,
      subtotal: toDollars(draft.subtotalCents),
      shippingFee: toDollars(draft.shippingFeeCents),
      totalAmount: toDollars(draft.totalAmountCents),
      currency: "USD",
      order: draft.order
        ? {
            id: draft.order.id,
            orderNumber: draft.order.orderNumber,
            status: draft.order.status.toLowerCase(),
            paymentStatus: draft.order.paymentStatus.toLowerCase(),
            paidAt: draft.order.paidAt,
          }
        : null,
      checkoutUrl: displayStatus(draft) === "link_sent" ? draft.checkoutUrl : null,
      checkoutExpiresAt: draft.checkoutExpiresAt,
      invoiceSentAt: draft.invoiceSentAt,
      cancelledAt: draft.cancelledAt,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  });
}

async function loadDraft(actor: DraftActor, id: string) {
  const draft = await prisma.draftOrder.findFirst({ where: { id, ...scopeFor(actor) }, include: DRAFT_INCLUDE });
  if (!draft) throw new Error("Draft order not found");
  return draft;
}

async function detail(actor: DraftActor, id: string, extra: Record<string, unknown> = {}) {
  const draft = await loadDraft(actor, id);
  const [formatted] = await formatDrafts([draft]);
  const pricing =
    draft.status === DraftOrderStatus.OPEN ? await quoteSafely(draft.customerId, draft) : { quote: null, quoteError: null };
  return { ...formatted, ...pricing, ...extra };
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

export async function lookupCustomers(search?: string) {
  const term = search?.trim();
  const customers = await prisma.user.findMany({
    where: {
      role: Role.MED,
      accountStatus: AccountStatus.ACTIVE,
      ...(term
        ? {
            OR: [
              { fullName: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { practiceName: { contains: term, mode: "insensitive" } },
              { phoneNumber: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { fullName: "asc" },
    take: 20,
  });
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.fullName,
    email: customer.email,
    phone: customer.phoneNumber,
    practiceName: customer.practiceName,
    practiceAddress: practiceAddress(customer),
  }));
}

export async function lookupProducts(search?: string) {
  const term = search?.trim();
  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { sku: { contains: term, mode: "insensitive" } },
              { category: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      variants: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { name: "asc" },
    take: 30,
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    imageUrl: commerceService.formatProduct(product).imageUrl,
    price: toDollars(product.priceCents),
    stockQty: product.stockQty,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      sku: variant.sku,
      price: toDollars(variant.priceCents ?? product.priceCents),
      stockQty: variant.stockQty ?? product.stockQty,
    })),
  }));
}

export async function quoteDraftInput(input: DraftOrderInput) {
  const customer = await requireCustomer(input.customerId);
  const items = await normalizeItems(input.items);
  const shipping = shippingFields(input, practiceAddress(customer));
  return quoteSafely(customer.id, { items, ...shipping, notes: cleanText(input.notes, 2000) });
}

// ─── Draft lifecycle ──────────────────────────────────────────────────────────

export async function listDraftOrders(
  actor: DraftActor,
  input: { page?: number; limit?: number; status?: string; search?: string } = {},
) {
  const page = Math.max(1, Number(input.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
  const term = input.search?.trim();

  const statusWhere: Record<string, object> = {
    open: { status: DraftOrderStatus.OPEN },
    link_sent: { status: DraftOrderStatus.INVOICE_SENT, order: { paymentStatus: { not: CommercePaymentStatus.PAID } } },
    paid: { status: DraftOrderStatus.INVOICE_SENT, order: { paymentStatus: CommercePaymentStatus.PAID } },
    cancelled: { status: DraftOrderStatus.CANCELLED },
  };

  const where: any = {
    ...scopeFor(actor),
    ...(input.status && statusWhere[input.status] ? statusWhere[input.status] : {}),
    ...(term
      ? {
          OR: [
            { draftNumber: { contains: term, mode: "insensitive" } },
            { customer: { fullName: { contains: term, mode: "insensitive" } } },
            { customer: { email: { contains: term, mode: "insensitive" } } },
            { order: { orderNumber: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [drafts, total] = await Promise.all([
    prisma.draftOrder.findMany({
      where,
      include: DRAFT_INCLUDE,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.draftOrder.count({ where }),
  ]);

  return { items: await formatDrafts(drafts), total, page, limit, hasMore: page * limit < total };
}

export async function getDraftOrder(actor: DraftActor, id: string) {
  return detail(actor, id);
}

export async function createDraftOrder(actor: DraftActor, input: DraftOrderInput) {
  const customer = await requireCustomer(input.customerId);
  const items = await normalizeItems(input.items);
  const shipping = shippingFields(input, practiceAddress(customer));
  const notes = cleanText(input.notes, 2000);
  const { quote } = await quoteSafely(customer.id, { items, ...shipping, notes });

  let created: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    try {
      created = await prisma.draftOrder.create({
        data: {
          draftNumber: await nextDraftNumber(),
          customerId: customer.id,
          createdById: actor.id,
          ...shipping,
          notes,
          subtotalCents: quote ? Math.round(quote.subtotalUsd * 100) : null,
          shippingFeeCents: quote ? Math.round(quote.shippingFeeUsd * 100) : null,
          totalAmountCents: quote ? Math.round(quote.totalUsd * 100) : null,
          items: { create: items },
        },
        select: { id: true },
      });
    } catch (error: any) {
      if (error?.code !== "P2002" || attempt === 2) throw error;
    }
  }
  return detail(actor, created!.id);
}

export async function updateDraftOrder(actor: DraftActor, id: string, input: DraftOrderInput) {
  const draft = await loadDraft(actor, id);
  if (draft.status !== DraftOrderStatus.OPEN) throw new Error("Only open drafts can be edited");

  const customer = await requireCustomer(input.customerId ?? draft.customerId);
  const items = input.items ? await normalizeItems(input.items) : null;
  const customerChanged = customer.id !== draft.customerId;
  const shipping = shippingFields(
    { shippingMethod: draft.shippingMethod, ...input },
    customerChanged
      ? practiceAddress(customer)
      : {
          address1: draft.shippingAddress1,
          address2: draft.shippingAddress2,
          city: draft.shippingCity,
          state: draft.shippingState,
          zipCode: draft.shippingZipCode,
          country: draft.shippingCountry,
        },
  );
  const notes = "notes" in input ? cleanText(input.notes, 2000) : draft.notes;
  const pricedItems = items ?? draft.items;
  const { quote } = await quoteSafely(customer.id, { items: pricedItems, ...shipping, notes });

  await prisma.$transaction(async (tx) => {
    await tx.draftOrder.update({
      where: { id: draft.id },
      data: {
        customerId: customer.id,
        ...shipping,
        notes,
        subtotalCents: quote ? Math.round(quote.subtotalUsd * 100) : null,
        shippingFeeCents: quote ? Math.round(quote.shippingFeeUsd * 100) : null,
        totalAmountCents: quote ? Math.round(quote.totalUsd * 100) : null,
      },
    });
    if (items) {
      await tx.draftOrderItem.deleteMany({ where: { draftOrderId: draft.id } });
      await tx.draftOrderItem.createMany({ data: items.map((item) => ({ ...item, draftOrderId: draft.id })) });
    }
  });
  return detail(actor, draft.id);
}

async function emailInvoice(draftId: string, actorId: string, checkoutUrl: string, expiresAt: Date | null) {
  const [draft, sender] = await Promise.all([
    prisma.draftOrder.findUnique({ where: { id: draftId }, include: { customer: true, order: { include: { items: true } } } }),
    prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } }),
  ]);
  if (!draft?.order) return false;
  return sendInvoiceEmail({
    to: draft.customer.email,
    customerName: draft.customer.fullName,
    orderNumber: draft.order.orderNumber,
    items: draft.order.items.map((item) => ({
      name: item.variantLabel ? `${item.productName} (${item.variantLabel})` : item.productName,
      quantity: item.quantity,
      lineTotalUsd: item.lineTotalCents / 100,
    })),
    shippingUsd: draft.order.shippingFeeCents / 100,
    totalUsd: draft.order.totalAmountCents / 100,
    checkoutUrl,
    expiresAt,
    senderName: sender?.fullName ?? "Hans Biomed",
  });
}

/** Turns an open draft into a pending order and emails the customer a Stripe payment link. */
export async function sendDraftOrder(actor: DraftActor, id: string) {
  const draft = await loadDraft(actor, id);
  if (draft.status !== DraftOrderStatus.OPEN) throw new Error("This draft was already sent");
  await requireCustomer(draft.customerId);

  // Claim the draft first so two clicks cannot create two orders.
  const claimed = await prisma.draftOrder.updateMany({
    where: { id: draft.id, status: DraftOrderStatus.OPEN },
    data: { status: DraftOrderStatus.INVOICE_SENT },
  });
  if (claimed.count === 0) throw new Error("This draft was already sent");

  let result;
  try {
    result = await commerceService.createInvoiceOrderForCustomer(
      draft.customerId,
      checkoutInput(draft),
      actor.id,
      draft.draftNumber,
    );
  } catch (error) {
    await prisma.draftOrder.update({ where: { id: draft.id }, data: { status: DraftOrderStatus.OPEN } });
    throw error;
  }

  await prisma.draftOrder.update({
    where: { id: draft.id },
    data: {
      orderId: result.order.id,
      checkoutUrl: result.checkoutUrl,
      checkoutExpiresAt: result.checkoutExpiresAt,
      invoiceSentAt: new Date(),
      subtotalCents: Math.round(result.order.subtotal * 100),
      shippingFeeCents: Math.round(result.order.shippingFee * 100),
      totalAmountCents: Math.round(result.order.totalAmount * 100),
    },
  });

  const emailSent = result.checkoutUrl
    ? await emailInvoice(draft.id, actor.id, result.checkoutUrl, result.checkoutExpiresAt)
    : false;
  return detail(actor, draft.id, { emailSent });
}

/** Issues a fresh payment link (the old one stops working) and emails it again. */
export async function resendDraftOrder(actor: DraftActor, id: string) {
  const draft = await loadDraft(actor, id);
  if (draft.status !== DraftOrderStatus.INVOICE_SENT || !draft.orderId) throw new Error("Send this draft first");

  const renewed = await commerceService.renewInvoiceCheckout(draft.orderId);
  await prisma.draftOrder.update({
    where: { id: draft.id },
    data: { checkoutUrl: renewed.checkoutUrl, checkoutExpiresAt: renewed.checkoutExpiresAt, invoiceSentAt: new Date() },
  });
  const emailSent = renewed.checkoutUrl
    ? await emailInvoice(draft.id, actor.id, renewed.checkoutUrl, renewed.checkoutExpiresAt)
    : false;
  return detail(actor, draft.id, { emailSent });
}

export async function cancelDraftOrder(actor: DraftActor, id: string) {
  const draft = await loadDraft(actor, id);
  if (draft.status === DraftOrderStatus.CANCELLED) return detail(actor, draft.id);
  if (draft.orderId) {
    await commerceService.cancelInvoiceOrder(draft.orderId, actor.id, `Draft ${draft.draftNumber} cancelled`);
  }
  await prisma.draftOrder.update({
    where: { id: draft.id },
    data: { status: DraftOrderStatus.CANCELLED, cancelledAt: new Date(), checkoutUrl: null },
  });
  return detail(actor, draft.id);
}
