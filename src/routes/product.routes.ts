import { Router } from "express";
import * as commerceController from "../controllers/commerce.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { Role } from "../generated/prisma/enums";

const router = Router();

router.use(authenticateToken);
router.use(requireRole(Role.USER, Role.MED, Role.ADMIN));

router.get("/", commerceController.getPublicProducts);
router.get("/:id", commerceController.getPublicProductById);

export default router;
