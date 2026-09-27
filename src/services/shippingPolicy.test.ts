import assert from "node:assert/strict";
import test from "node:test";
import { shippingFeeCents } from "./shippingPolicy";

test("adds 10% to UPS rates below the card merchandise threshold", () => {
  assert.equal(shippingFeeCents(20, 249_999), 2_200);
  assert.equal(shippingFeeCents(10.05, 0), 1_106);
});

test("waives shipping at exactly $2,500 in card merchandise", () => {
  assert.equal(shippingFeeCents(90, 250_000), 0);
  assert.equal(shippingFeeCents(90, 300_000), 0);
});

test("credits only reduce the product amount used for free-shipping eligibility", () => {
  const subtotalCents = 300_000;
  const creditAppliedCents = 50_001;
  assert.equal(shippingFeeCents(20, subtotalCents - creditAppliedCents), 2_200);
});

test("rejects an invalid UPS rate", () => {
  assert.throws(() => shippingFeeCents(Number.NaN, 1_000), /Unable to calculate shipping cost/);
});
