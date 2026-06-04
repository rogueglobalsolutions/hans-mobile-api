import { Request, Response } from "express";
import * as commerceService from "../services/commerce.service";
import { sanitizeError } from "../utils/errors";

function num(value: unknown) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function str(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function param(value: unknown) {
  const parsed = str(value);
  if (!parsed) throw new Error("Missing route parameter");
  return parsed;
}

function sendError(res: Response, err: unknown, operation: string, status = 500) {
  const message = sanitizeError(err, operation);
  res.status(status).json({ success: false, message });
}

export async function getAdminDashboard(req: Request, res: Response) {
  try {
    const data = await commerceService.getAdminDashboard();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceDashboard");
  }
}

export async function getAdminProducts(req: Request, res: Response) {
  try {
    const data = await commerceService.getProducts({
      page: num(req.query.page),
      limit: num(req.query.limit),
      search: str(req.query.search),
      status: str(req.query.status) as any,
      sortBy: str(req.query.sortBy) as any,
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceProducts");
  }
}

export async function getPublicProducts(req: Request, res: Response) {
  try {
    const data = await commerceService.getProducts({
      page: num(req.query.page),
      limit: num(req.query.limit),
      search: str(req.query.search),
      vendor: str(req.query.vendor),
      category: str(req.query.category),
      publicOnly: true,
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceProducts");
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const data = await commerceService.getProductById(param(req.params.id), false);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceProductById", 404);
  }
}

export async function getPublicProductById(req: Request, res: Response) {
  try {
    const data = await commerceService.getProductById(param(req.params.id), true);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceProductById", 404);
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.updateProduct(param(req.params.id), adminId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceProduct", 400);
  }
}

export async function updateProductStatus(req: Request, res: Response) {
  try {
    if (!req.body.status) {
      res.status(400).json({ success: false, message: "status is required" });
      return;
    }
    const data = await commerceService.updateProductStatus(param(req.params.id), req.body.status);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceProduct", 400);
  }
}

export async function updateProductStock(req: Request, res: Response) {
  try {
    const stockQty = num(req.body.stockQty);
    if (stockQty == null) {
      res.status(400).json({ success: false, message: "stockQty is required" });
      return;
    }
    const adminId = (req as any).userId as string;
    const data = await commerceService.updateProductStock(param(req.params.id), adminId, stockQty, req.body.note);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceProduct", 400);
  }
}

export async function getLowStockProducts(req: Request, res: Response) {
  try {
    const data = await commerceService.getLowStockProducts(num(req.query.threshold));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getLowStockProducts");
  }
}

export async function getAdminOrders(req: Request, res: Response) {
  try {
    const data = await commerceService.getOrders({
      page: num(req.query.page),
      limit: num(req.query.limit),
      search: str(req.query.search),
      status: str(req.query.status),
      dateFilterType: str(req.query.dateFilterType) as any,
      startDate: str(req.query.startDate),
      endDate: str(req.query.endDate),
      includeArchived: req.query.includeArchived === "true",
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceOrders");
  }
}

export async function getRecentOrders(req: Request, res: Response) {
  try {
    const data = await commerceService.getRecentOrders(num(req.query.limit));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceOrders");
  }
}

export async function getOrderCounts(req: Request, res: Response) {
  try {
    const data = await commerceService.getOrderCounts(str(req.query.dateFilterType) as any);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceOrders");
  }
}

export async function getAdminOrderById(req: Request, res: Response) {
  try {
    const data = await commerceService.getOrderById(param(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceOrderById", 404);
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.updateOrderStatus(param(req.params.id), adminId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceOrder", 400);
  }
}

export async function updateOrderTracking(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.updateOrderTracking(param(req.params.id), adminId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceOrder", 400);
  }
}

export async function verifyOrder(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.verifyOrder(param(req.params.id), adminId, req.body.note);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceOrder", 400);
  }
}

export async function cancelOrder(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.cancelOrder(param(req.params.id), adminId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceOrder", 400);
  }
}

export async function refundOrder(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.refundOrder(param(req.params.id), adminId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "refundCommerceOrder", 400);
  }
}

export async function archiveOrder(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.archiveOrder(param(req.params.id), adminId, req.body.note);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateCommerceOrder", 400);
  }
}

export async function duplicateOrder(req: Request, res: Response) {
  try {
    const data = await commerceService.getDuplicateOrderPayload(param(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceOrderById", 404);
  }
}

export async function getCustomers(req: Request, res: Response) {
  try {
    const data = await commerceService.getCustomers({
      page: num(req.query.page),
      limit: num(req.query.limit),
      search: str(req.query.search),
      role: str(req.query.role),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceCustomers");
  }
}

export async function getCustomerById(req: Request, res: Response) {
  try {
    const data = await commerceService.getCustomerById(param(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceCustomerById", 404);
  }
}

export async function getRevenueSummary(req: Request, res: Response) {
  try {
    const data = await commerceService.getRevenueSummary({
      filterType: str(req.query.filterType) as any,
      startDate: str(req.query.startDate),
      endDate: str(req.query.endDate),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceReports");
  }
}

export async function getSalesReport(req: Request, res: Response) {
  try {
    const data = await commerceService.getSalesReport({
      filterType: str(req.query.filterType) as any,
      startDate: str(req.query.startDate),
      endDate: str(req.query.endDate),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceReports");
  }
}

export async function getOrdersBreakdown(req: Request, res: Response) {
  try {
    const data = await commerceService.getOrdersBreakdown({
      startDate: str(req.query.startDate),
      endDate: str(req.query.endDate),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceReports");
  }
}

export async function getTopProducts(req: Request, res: Response) {
  try {
    const data = await commerceService.getTopProducts({
      sortBy: str(req.query.sortBy) as any,
      limit: num(req.query.limit),
      startDate: str(req.query.startDate),
      endDate: str(req.query.endDate),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceReports");
  }
}

export async function getShippingLabels(req: Request, res: Response) {
  try {
    const data = await commerceService.getShippingLabels({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
      carrier: str(req.query.carrier),
      startDate: str(req.query.startDate),
      endDate: str(req.query.endDate),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getShippingLabels");
  }
}

export async function getShippingLabelById(req: Request, res: Response) {
  try {
    const data = await commerceService.getShippingLabelById(param(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getShippingLabelById", 404);
  }
}

export async function createShippingLabel(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.createShippingLabel(param(req.params.id), adminId, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    sendError(res, err, "createShippingLabel", 400);
  }
}

export async function markShippingLabelPrinted(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.markShippingLabelPrinted(param(req.params.id), adminId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateShippingLabel", 400);
  }
}

export async function voidShippingLabel(req: Request, res: Response) {
  try {
    const adminId = (req as any).userId as string;
    const data = await commerceService.voidShippingLabel(param(req.params.id), adminId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "updateShippingLabel", 400);
  }
}

export async function createProductOrderIntent(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const data = await commerceService.createProductOrderIntent(userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    sendError(res, err, "createProductOrderIntent", 400);
  }
}

export async function confirmProductOrderPayment(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    if (!req.body.paymentIntentId) {
      res.status(400).json({ success: false, message: "paymentIntentId is required" });
      return;
    }
    const data = await commerceService.confirmProductOrderPayment(userId, req.body.paymentIntentId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "confirmProductOrderPayment", 400);
  }
}

export async function getMyOrders(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const data = await commerceService.getMyOrders(userId, str(req.query.status));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getMyCommerceOrders");
  }
}

export async function getMyOrderById(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const data = await commerceService.getOrderById(param(req.params.id), userId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err, "getCommerceOrderById", 404);
  }
}
