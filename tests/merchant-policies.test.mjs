import test from "node:test";
import assert from "node:assert/strict";
import { merchantOfferPolicies } from "../app/lib/merchant-policies.ts";

test("merchant policies use the configured checkout shipping rate and supported destination", () => {
  for (const cents of [0, 595, 1299]) {
    const { shippingDetails } = merchantOfferPolicies(cents, false);
    assert.equal(shippingDetails.shippingRate.value, cents / 100);
    assert.equal(shippingDetails.shippingRate.currency, "USD");
    assert.equal(shippingDetails.shippingDestination.addressCountry, "US");
    assert.equal(shippingDetails.shippingSettingsLink, "https://www.vineyardsun.com/shipping-returns");
  }
});

test("consumer return markup includes the confirmed window without inventing free returns", () => {
  const { hasMerchantReturnPolicy: policy } = merchantOfferPolicies(595, false);
  assert.equal(policy.applicableCountry, "US");
  assert.equal(policy.returnPolicyCategory, "https://schema.org/MerchantReturnFiniteReturnWindow");
  assert.equal(policy.merchantReturnDays, 30);
  assert.equal(policy.returnMethod, "https://schema.org/ReturnByMail");
  assert.equal(policy.merchantReturnLink, "https://www.vineyardsun.com/shipping-returns");
  assert.equal(policy.returnFees, "https://schema.org/ReturnFeesCustomerResponsibility");
  assert.equal(policy.returnShippingFeesAmount, undefined);
});

test("stocked and made-to-order delivery estimates fit the approved checkout window", () => {
  for (const [madeToOrder, min, max, totalMin, totalMax] of [[false, 1, 2, 4, 9], [true, 2, 5, 5, 12]]) {
    const { deliveryTime } = merchantOfferPolicies(595, madeToOrder).shippingDetails;
    assert.equal(deliveryTime["@type"], "ShippingDeliveryTime");
    assert.deepEqual(deliveryTime.handlingTime, { "@type": "QuantitativeValue", minValue: min, maxValue: max, unitCode: "DAY" });
    assert.deepEqual(deliveryTime.transitTime, { "@type": "QuantitativeValue", minValue: 3, maxValue: 7, unitCode: "DAY" });
    assert.equal(deliveryTime.handlingTime.minValue + deliveryTime.transitTime.minValue, totalMin);
    assert.equal(deliveryTime.handlingTime.maxValue + deliveryTime.transitTime.maxValue, totalMax);
    assert.equal(deliveryTime.businessDays.dayOfWeek.length, 5);
  }
});
