import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";

test("paid webhook records one purchase and test fulfillment stays disabled on retries", async () => {
  const source = await fs.readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const events = new Map(), states = [], secret = "whsec_local_unit_test";
  const stripe = new Stripe("sk_test_local_unit_test");
  const visit = randomUUID();
  const session = { id: "cs_test_unit", metadata: { order_id: "order-unit", analytics_session_id: visit }, payment_status: "paid", livemode: false, amount_total: 5895, amount_subtotal: 5300, total_details: { amount_shipping: 595 }, collected_information: { shipping_details: { name: "Unit Test" } }, customer_details: { email: "test@example.com" } };
  const fakeStripe = { webhooks: stripe.webhooks, checkout: { sessions: { retrieve: async () => session } } };
  const exported = {};
  const modules = {
    "../../../lib/stripe": { getStripe: () => fakeStripe, getWebhookSecret: () => secret },
    "../../../lib/printful": { submitPrintfulOrder: async () => { throw new Error("Test payments must never reach Printful"); } },
    "../../../../db/orders": { recordPaidCheckout: async () => ({ id: "order-unit" }), markFulfillmentState: async state => states.push(state), markCheckoutStatus: async () => { throw new Error("Paid session incorrectly marked pending"); }, claimOrderForFulfillment: async () => { throw new Error("Test fulfillment must be skipped"); } },
    "../../../../db/conversions": { recordConversion: async event => events.set(event.id, event), isConversionTest: () => false },
    "../../../lib/conversion-validation": { sessionId: value => value },
  };
  vm.runInNewContext(code, { exports: exported, require: name => { assert.ok(modules[name], `Unexpected dependency ${name}`); return modules[name]; }, process: { env: {} }, Response, console });
  const payload = JSON.stringify({ id: "evt_unit", type: "checkout.session.completed", data: { object: { id: session.id } } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  for (let i = 0; i < 2; i++) {
    const response = await exported.POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": header }, body: payload }));
    assert.equal(response.status, 200);
  }
  assert.equal(events.size, 1); assert.equal(events.get("purchase:order-unit").valueCents, 5895); assert.equal(events.get("purchase:order-unit").isTest, true);
  assert.equal(events.get("purchase:order-unit").sessionId, visit);
  assert.equal(states.every(state => state.status === "test_skipped"), true);
  assert.equal((await exported.POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload }))).status, 400);
});
