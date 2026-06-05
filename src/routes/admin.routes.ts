import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import * as trainingController from "../controllers/training.controller";
import * as appointmentController from "../controllers/appointment.controller";
import * as baController from "../controllers/ba.controller";
import * as salesRepController from "../controllers/salesRep.controller";
import * as trainingDocController from "../controllers/trainingDoc.controller";
import * as commerceController from "../controllers/commerce.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";
import { uploadTrainingBg, uploadTrainingDocs } from "../middleware/upload";

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

// ─── Verification management ──────────────────────────────────────────────────

router.get("/users", verificationController.getAllUsers);
router.get("/verifications", verificationController.getMedUsers);
router.get("/verifications/pending", verificationController.getPendingVerifications);
router.get("/verifications/:userId", verificationController.getMedUserById);
router.post("/verifications/:userId/approve", verificationController.approveVerification);
router.post("/verifications/:userId/reject", verificationController.rejectVerification);

// ─── Training management ──────────────────────────────────────────────────────

router.post(
  "/trainings",
  uploadTrainingBg.fields([
    { name: "backgroundImage", maxCount: 1 },
    { name: "speakerImage", maxCount: 1 },
  ]),
  trainingController.createTraining,
);
router.patch(
  "/trainings/:id",
  uploadTrainingBg.fields([
    { name: "backgroundImage", maxCount: 1 },
    { name: "speakerImage", maxCount: 1 },
  ]),
  trainingController.updateTraining,
);
router.delete("/trainings/:id", trainingController.deleteTraining);
router.post("/trainings/:id/cancel", trainingController.cancelTraining);
router.get("/trainings/:id/enrollees", trainingController.getTrainingEnrollees);

// Training document management
router.get("/trainings/:id/folders", trainingDocController.getFolders);
router.post("/trainings/:id/folders", trainingDocController.createFolder);
router.post(
  "/trainings/:id/folders/:folderId/upload",
  uploadTrainingDocs.single("file"),
  trainingDocController.uploadDocument,
);
router.delete("/trainings/:id/folders/:folderId", trainingDocController.deleteFolder);
router.delete("/trainings/:id/documents/:docId", trainingDocController.deleteDocument);

// File download (any uploaded file)
router.get("/download", trainingDocController.downloadFile);

// ─── Appointment management ───────────────────────────────────────────────────

router.get("/appointments", appointmentController.getAppointmentRequests);
router.post("/appointments/:id/approve", appointmentController.approveAppointment);
router.post("/appointments/:id/reject", appointmentController.rejectAppointment);
router.post("/appointments/:id/complete", appointmentController.completeAppointment);

// ─── Before & After management ───────────────────────────────────────────────

router.get("/ba/entries", baController.getAllEntries);
router.get("/ba/entries/:id", baController.getEntryByIdAdmin);
router.get("/ba/contest", baController.getAllContestEntries);
router.get("/ba/contest/:id", baController.getContestEntryByIdAdmin);
router.post("/ba/contest/:id/like", baController.toggleContestLike);
router.get("/ba/stats", baController.getBAStats);

// ─── Sales Rep management ─────────────────────────────────────────────────────

router.post("/sales-reps", salesRepController.createSalesRep);

// ─── Commerce management ──────────────────────────────────────────────────────

router.get("/commerce/dashboard", commerceController.getAdminDashboard);

router.get("/commerce/orders/recent", commerceController.getRecentOrders);
router.get("/commerce/orders/counts", commerceController.getOrderCounts);
router.get("/commerce/orders", commerceController.getAdminOrders);
router.get("/commerce/orders/:id", commerceController.getAdminOrderById);
router.patch("/commerce/orders/:id/status", commerceController.updateOrderStatus);
router.patch("/commerce/orders/:id/tracking", commerceController.updateOrderTracking);
router.post("/commerce/orders/:id/verify", commerceController.verifyOrder);
router.post("/commerce/orders/:id/cancel", commerceController.cancelOrder);
router.post("/commerce/orders/:id/refund", commerceController.refundOrder);
router.post("/commerce/orders/:id/archive", commerceController.archiveOrder);
router.post("/commerce/orders/:id/duplicate", commerceController.duplicateOrder);
router.post("/commerce/orders/:id/shipping-labels", commerceController.createShippingLabel);

router.get("/commerce/shipping-labels", commerceController.getShippingLabels);
router.get("/commerce/shipping-labels/:id", commerceController.getShippingLabelById);
router.patch("/commerce/shipping-labels/:id/printed", commerceController.markShippingLabelPrinted);
router.post("/commerce/shipping-labels/:id/void", commerceController.voidShippingLabel);

router.get("/commerce/products/low-stock", commerceController.getLowStockProducts);
router.get("/commerce/products", commerceController.getAdminProducts);
router.get("/commerce/products/:id", commerceController.getProductById);
router.patch("/commerce/products/:id", commerceController.updateProduct);
router.patch("/commerce/products/:id/status", commerceController.updateProductStatus);
router.patch("/commerce/products/:id/stock", commerceController.updateProductStock);

router.get("/commerce/customers", commerceController.getCustomers);
router.get("/commerce/customers/:id", commerceController.getCustomerById);

router.get("/commerce/reports/revenue", commerceController.getRevenueSummary);
router.get("/commerce/reports/sales", commerceController.getSalesReport);
router.get("/commerce/reports/orders-breakdown", commerceController.getOrdersBreakdown);
router.get("/commerce/reports/top-products", commerceController.getTopProducts);

export default router;
