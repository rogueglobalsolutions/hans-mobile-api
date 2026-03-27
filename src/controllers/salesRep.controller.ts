import { Request, Response } from "express";
import * as salesRepService from "../services/salesRep.service";
import { sanitizeError } from "../utils/errors";

export async function getTransactions(req: Request, res: Response) {
  try {
    const salesRepId = (req as any).userId as string;
    const transactions = await salesRepService.getRecentTransactions(salesRepId);
    res.json({ success: true, data: transactions });
  } catch (err) {
    const msg = sanitizeError(err, "getTransactions");
    res.status(500).json({ success: false, message: msg });
  }
}

export async function getEnrollees(req: Request, res: Response) {
  try {
    const data = await salesRepService.getEnrolleesByTraining();
    res.json({ success: true, data });
  } catch (err) {
    const msg = sanitizeError(err, "getEnrollees");
    res.status(500).json({ success: false, message: msg });
  }
}

export async function listSalesReps(req: Request, res: Response) {
  try {
    const reps = await salesRepService.listSalesReps();
    res.json({ success: true, data: reps });
  } catch (err) {
    const msg = sanitizeError(err, "listSalesReps");
    res.status(500).json({ success: false, message: msg });
  }
}

export async function createSalesRep(req: Request, res: Response) {
  try {
    const { fullName, email, phoneNumber, password } = req.body;
    if (!fullName || !email || !phoneNumber || !password) {
      res.status(400).json({ success: false, message: "fullName, email, phoneNumber, and password are required" });
      return;
    }
    const rep = await salesRepService.createSalesRep(fullName, email, phoneNumber, password);
    res.status(201).json({ success: true, data: rep });
  } catch (err) {
    const msg = sanitizeError(err, "createSalesRep");
    const status = msg.includes("already exists") ? 409 : 500;
    res.status(status).json({ success: false, message: msg });
  }
}
