import { Router } from "express";
import * as commerceController from "../controllers/commerce.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(Role.MED));

router.post("/create-intent", commerceController.createProductOrderIntent);
router.post("/confirm", commerceController.confirmProductOrderPayment);
router.get("/my", commerceController.getMyOrders);
router.get("/:id", commerceController.getMyOrderById);

export default router;
