import { Router } from "express";
import * as commerceController from "../controllers/commerce.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(Role.MED));

router.get("/checkout-profile", commerceController.getProductCheckoutProfile);
router.post("/quote", commerceController.quoteProductOrder);
router.post("/create-intent", commerceController.createProductOrderIntent);
router.post("/confirm", commerceController.confirmProductOrderPayment);
router.post("/discard-intent", commerceController.discardProductOrderIntent);
router.get("/my", commerceController.getMyOrders);
router.get("/:id", commerceController.getMyOrderById);
router.post("/:id/request-cancellation", commerceController.requestOrderCancellation);

export default router;
