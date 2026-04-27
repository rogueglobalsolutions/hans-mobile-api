import { Router } from "express";
import * as locationController from "../controllers/location.controller";

const router = Router();

router.get("/countries", locationController.getCountries);
router.get("/states/:countryCode", locationController.getStates);
router.get("/cities/:countryCode/:stateCode", locationController.getCities);

export default router;
