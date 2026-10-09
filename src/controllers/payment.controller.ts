import { Request, Response } from "express";
import { stripe } from "../config/stripe";
import * as trainingService from "../services/training.service";
import * as commerceService from "../services/commerce.service";
import * as trainingLifecycleService from "../services/trainingLifecycle.service";
import { sanitizeError } from "../utils/errors";
import { EnrollmentType } from "../generated/prisma/enums";
import type Stripe from "stripe";

function paymentKind(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.metadata?.orderId || paymentIntent.metadata?.kind === "product_order") {
    return "product_order";
  }
  if (paymentIntent.metadata?.kind === "training_no_show_fee") return "training_no_show_fee";
  if (paymentIntent.metadata?.trainingId) return "training_enrollment";
  return "unknown";
}

export async function getConfig(req: Request, res: Response) {
  res.json({
    success: true,
    data: { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY },
  });
}

export async function createPaymentIntent(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { trainingId, salesRepId, subOptionIndex, discountCode, enrollmentType } = req.body;
    if (!trainingId) {
      res.status(400).json({ success: false, message: "trainingId is required" });
      return;
    }
    const requestedType = enrollmentType ?? EnrollmentType.ENROLLEE;
    if (requestedType !== EnrollmentType.ENROLLEE && requestedType !== EnrollmentType.OBSERVER) {
      res.status(400).json({ success: false, message: "Invalid enrollment type" });
      return;
    }
    const result = await trainingService.initiateEnrollment(
      userId,
      trainingId,
      salesRepId,
      subOptionIndex !== undefined ? Number(subOptionIndex) : undefined,
      discountCode || undefined,
      requestedType,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof trainingService.ObserverConfirmationRequiredError) {
      res.status(409).json({
        success: false,
        code: err.code,
        message: err.message,
        data: { observerPriceUsd: err.observerPriceUsd },
      });
      return;
    }
    const msg = sanitizeError(err, "createPaymentIntent");
    const clientErrors = [
      "Training not found",
      "Training is not available",
      "Enrollment is closed",
      "Training is full",
      "You must complete",
      "Already enrolled",
      "This registration was cancelled",
      "Observer enrollment is only available",
      "Submit the training application before payment",
      "This training is full",
      "Discount code is invalid or no longer available",
    ];
    const rawMessage = err instanceof Error ? err.message : "";
    const status = clientErrors.some((e) => rawMessage.includes(e)) ? 400 : 500;
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
    const result = await trainingService.confirmEnrollmentPayment(paymentIntentId, (req as any).userId as string);
    res.json({ success: true, data: result });
  } catch (err) {
    const msg = sanitizeError(err, "confirmPayment");
    res.status(400).json({ success: false, message: msg });
  }
}

// ─── Called by client when user cancels/dismisses payment sheet ───────────────

export async function failPayment(req: Request, res: Response) {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      res.status(400).json({ success: false, message: "paymentIntentId is required" });
      return;
    }
    await trainingService.failEnrollment(paymentIntentId, (req as any).userId as string);
    res.json({ success: true, message: "Enrollment marked as failed" });
  } catch (err) {
    const msg = sanitizeError(err, "failPayment");
    res.status(400).json({ success: false, message: msg });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

// Landing page after a customer pays an invoice link. Payment is confirmed by the webhook,
// so this page only acknowledges the redirect.
export function checkoutComplete(req: Request, res: Response) {
  const orderNumber = typeof req.query.order === "string" ? escapeHtml(req.query.order.slice(0, 64)) : "";
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Payment received · Hans Biomed</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f4f8;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0e1a33">
<main style="max-width:420px;margin:24px;padding:32px;background:#fff;border:1px solid #e1e5ec;border-radius:12px">
<h1 style="margin:0 0 8px;font-size:22px">Payment received</h1>
<p style="margin:0 0 16px;color:#3f4b63;line-height:1.5">Thank you. ${orderNumber ? `Your order <strong>${orderNumber}</strong> is` : "Your order is"} now being processed, and you can follow it in the Hans app.</p>
<p style="margin:0;color:#5f6b82;font-size:13px">You can close this page.</p>
</main></body></html>`);
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
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const kind = paymentKind(paymentIntent);
      if (kind === "product_order") {
        await commerceService.confirmProductOrderPaymentFromWebhook(paymentIntent);
      } else if (kind === "training_enrollment") {
        await trainingService.confirmEnrollmentPayment(paymentIntent.id);
      } else if (kind === "training_no_show_fee") {
        await trainingLifecycleService.confirmNoShowFee(
          paymentIntent.metadata.userId,
          paymentIntent.metadata.enrollmentId,
          paymentIntent.id,
        );
      } else {
        console.warn(`[stripe.webhook] Ignoring unrecognized PaymentIntent ${paymentIntent.id}`);
      }
    }
    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const kind = paymentKind(paymentIntent);
      if (kind === "product_order") {
        await commerceService.failProductOrderPaymentFromWebhook(
          paymentIntent.id,
          event.type === "payment_intent.canceled",
        );
      } else if (kind === "training_enrollment") {
        await trainingService.failEnrollment(paymentIntent.id);
      } else if (kind === "training_no_show_fee") {
        await trainingLifecycleService.failNoShowFee(paymentIntent.id);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}
