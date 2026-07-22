import { Router } from "express";
import * as webAuthController from "../../controllers/web/webAuth.controller";

const router = Router();

router.post("/login", webAuthController.login);

export default router;
