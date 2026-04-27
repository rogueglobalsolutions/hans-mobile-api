import { Request, Response } from "express";
import * as locationService from "../services/location.service";
import { sanitizeError } from "../utils/errors";

export async function getCountries(req: Request, res: Response) {
  try {
    const countries = await locationService.listCountries();
    res.json({ success: true, data: countries });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "locations.getCountries") });
  }
}

export async function getStates(req: Request<{ countryCode: string }>, res: Response) {
  try {
    const { countryCode } = req.params;
    const states = await locationService.listStates(countryCode);
    res.json({ success: true, data: states });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "locations.getStates") });
  }
}

export async function getCities(req: Request<{ countryCode: string; stateCode: string }>, res: Response) {
  try {
    const { countryCode, stateCode } = req.params;
    const cities = await locationService.listCities(countryCode, stateCode);
    res.json({ success: true, data: cities });
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeError(error, "locations.getCities") });
  }
}
