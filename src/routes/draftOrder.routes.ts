import { Router } from "express";
import * as draftOrderController from "../controllers/draftOrder.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

// Admins and sales reps prepare orders for medical professionals. Sales reps only
// see the drafts they created (enforced in the service).
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN, Role.SALES_REP));

router.get("/lookup/customers", draftOrderController.lookupCustomers);
router.get("/lookup/products", draftOrderController.lookupProducts);
router.post("/quote", draftOrderController.quote);

router.get("/", draftOrderController.list);
router.post("/", draftOrderController.create);
router.get("/:id", draftOrderController.get);
router.patch("/:id", draftOrderController.update);
router.post("/:id/send", draftOrderController.send);
router.post("/:id/resend", draftOrderController.resend);
router.post("/:id/cancel", draftOrderController.cancel);

export default router;
