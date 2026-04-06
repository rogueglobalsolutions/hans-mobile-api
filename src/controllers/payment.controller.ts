import { Request, Response } from "express";
import { stripe } from "../config/stripe";
import * as trainingService from "../services/training.service";
import { sanitizeError } from "../utils/errors";

export async function getConfig(req: Request, res: Response) {
  res.json({
    success: true,
    data: { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY },
  });
}

export async function createPaymentIntent(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { trainingId, salesRepId } = req.body;

    if (!trainingId) {
      res.status(400).json({ success: false, message: "trainingId is required" });
      return;
    }

    const result = await trainingService.initiateEnrollment(userId, trainingId, salesRepId);
    res.json({ success: true, data: result });
  } catch (err) {
    const msg = sanitizeError(err, "createPaymentIntent");
    const clientErrors = [
      "Training not found",
      "Training is not available",
      "Training is full",
      "You must complete",
      "Already enrolled",
    ];
    const status = clientErrors.some((e) => msg.includes(e)) ? 400 : 500;
    res.status(status).json({ success: false, message: msg });
  }
}

export async function confirmPayment(req: Request, res: Response) {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      res.status(400).json({ success: false, message: "paymentIntentId is required" });
      return;
    }
    const result = await trainingService.confirmEnrollmentPayment(paymentIntentId);
    res.json({ success: true, data: result });
  } catch (err) {
    const msg = sanitizeError(err, "confirmPayment");
    res.status(400).json({ success: false, message: msg });
  }
}

export async function handleWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    res.status(500).json({ success: false, message: "Webhook secret not configured" });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature error:", err.message);
    res.status(400).json({ success: false, message: "Webhook signature verification failed" });
    return;
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as any;
      await trainingService.confirmEnrollmentPayment(paymentIntent.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}
