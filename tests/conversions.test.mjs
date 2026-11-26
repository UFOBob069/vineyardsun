import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseCart, addCartLine, removePurchasedLines } from "../app/lib/cart.ts";
import { parseEnquiry, parseEvent, publicPath } from "../app/lib/conversion-validation.ts";
const first = { productId: 1, productHandle: "syrah", variantId: 11, quantity: 2 };
const other = { productId: 2, productHandle: "pillow", variantId: 22, quantity: 1 };
test("saved bags reject invalid lines and clamp quantities", () => {
  assert.deepEqual(parseCart({}), []);
  assert.deepEqual(parseCart([null, { ...first, quantity: -1 }, { ...first, quantity: 1.5 }, { ...first, quantity: 1000 }]), [{ ...first, quantity: 10 }]);
});
test("adding the same SKU merges quantity without merging other variants", () => {
  assert.deepEqual(addCartLine([first, other], { ...first, quantity: 3 }), [{ ...first, quantity: 5 }, other]);
  assert.equal(addCartLine([first], { ...first, variantId: 12 }).length, 2);
});
test("confirmed bag purchases preserve other items and quantities added later", () => {
  assert.deepEqual(removePurchasedLines([{ ...first, quantity: 4 }, other], [first]), [{ ...first, quantity: 2 }, other]);
  assert.deepEqual(removePurchasedLines([first, other], [first]), [other]);
  assert.deepEqual(removePurchasedLines([first], [{ ...first, variantId: 12 }]), [first]);
});
test("legacy bags without product handles still reconcile purchased variants", () => {
  const legacy = parseCart([{ productId: 1, variantId: 11, quantity: 2 }]);
  assert.deepEqual(removePurchasedLines(legacy, [first]), []);
});
test("enquiries require contact details and a project, preserve input, and reject spam fields", () => {
  const lead = { id: randomUUID(), name: " Test Buyer ", email: "Buyer@Example.com", winery: "Test Vineyard", notes: "100 custom pairs for an event", quantity: "100" };
  assert.equal(parseEnquiry(lead).email, "buyer@example.com");
  assert.equal(parseEnquiry(lead).name, "Test Buyer");
  for (const invalid of [{ ...lead, email: "no-email" }, { ...lead, name: "" }, { ...lead, notes: "" }, { ...lead, notes: "x".repeat(3001) }, { ...lead, website: "spam" }, { ...lead, id: "not-a-uuid" }]) assert.throws(() => parseEnquiry(invalid));
});
test("public event ingestion cannot forge purchases or leak URLs and text", () => {
  const event = { id: randomUUID(), sessionId: randomUUID(), name: "variant_changed", path: "/products/syrah?email=private@example.com", productHandle: "syrah", variantId: 11, email: "private@example.com", notes: "secret" };
  const parsed = parseEvent(event);
  assert.equal(parsed.path, "/products/syrah");
  assert.equal("email" in parsed, false); assert.equal("notes" in parsed, false);
  assert.throws(() => parseEvent({ ...event, name: "purchase" }));
  assert.throws(() => parseEvent({ ...event, name: "enquiry_submitted" }));
  assert.equal(publicPath("https://other.example/path?secret=x"), "/");
  assert.equal(publicPath("/admin"), "/");
});
