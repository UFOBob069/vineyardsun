import test from "node:test";
import assert from "node:assert/strict";
import { merchantOfferPolicies } from "../app/lib/merchant-policies.ts";

test("merchant policies use the configured checkout shipping rate and supported destination", () => {
  for (const cents of [0, 595, 1299]) {
    const { shippingDetails } = merchantOfferPolicies(cents);
    assert.equal(shippingDetails.shippingRate.value, cents / 100);
    assert.equal(shippingDetails.shippingRate.currency, "USD");
    assert.equal(shippingDetails.shippingDestination.addressCountry, "US");
    assert.equal(shippingDetails.shippingSettingsLink, "https://www.vineyardsun.com/shipping-returns");
    assert.equal(shippingDetails.deliveryTime, undefined, "Do not invent separate handling/transit estimates");
  }
});

test("consumer return markup includes the confirmed window without inventing free returns", () => {
  const { hasMerchantReturnPolicy: policy } = merchantOfferPolicies(595);
  assert.equal(policy.applicableCountry, "US");
  assert.equal(policy.returnPolicyCategory, "https://schema.org/MerchantReturnFiniteReturnWindow");
  assert.equal(policy.merchantReturnDays, 30);
  assert.equal(policy.returnMethod, "https://schema.org/ReturnByMail");
  assert.equal(policy.merchantReturnLink, "https://www.vineyardsun.com/shipping-returns");
  assert.equal(policy.returnFees, undefined);
  assert.equal(policy.returnShippingFeesAmount, undefined);
});
