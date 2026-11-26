import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

const base = process.env.TEST_BASE_URL;
test("conversion APIs: persistence, validation, access control, exact checkout, and verified payment events", { skip: !base }, async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Integration tests only run against a local test server");
  process.loadEnvFile(".env.local");
  assert.ok(process.env.STRIPE_SECRET_KEY.startsWith("sk_test_"), "A Stripe test key is required");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY), sql = neon(process.env.DATABASE_URL);
  const visit = randomUUID(), leadId = randomUUID(), eventId = randomUUID();
  let session, cookie;
  const send = (path, body, extra = {}) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...extra }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + "/api/admin/conversions")).status, 401);
    assert.equal((await fetch(base + "/api/admin/conversions", { method: "PATCH", headers: { "Content-Type": "application/json", Origin: base }, body: "{}" })).status, 401);
    const lead = { id: leadId, sessionId: visit, name: "Conversion QA", email: "conversion-qa@example.com", winery: "TEST - Vineyard Sun QA", quantity: "100", notes: "Automated local test. Do not contact or fulfill." };
    assert.equal((await send("/api/enquiries", lead, { Origin: "https://other.example" })).status, 403);
    assert.equal((await send("/api/enquiries", { ...lead, email: "invalid" })).status, 400);
    assert.equal((await send("/api/enquiries", { ...lead, website: "bot" })).status, 400);
    assert.equal((await send("/api/enquiries", lead)).status, 201);
    assert.equal((await send("/api/enquiries", lead)).status, 201);
    const rows = await sql`SELECT id, is_test FROM vineyard_enquiries WHERE id = ${leadId}`;
    assert.equal(rows.length, 1); assert.equal(rows[0].is_test, true, "Local test submissions must be excluded from reports");
    assert.equal((await sql`SELECT id FROM conversion_events WHERE id = ${'enquiry:' + leadId}`).length, 1);
    const event = { id: eventId, sessionId: visit, name: "product_view", path: "/products/syrah-cork-sunglasses?email=private@example.com", productHandle: "syrah-cork-sunglasses", funnel: "retail" };
    assert.equal((await send("/api/events", { ...event, name: "purchase" })).status, 400);
    assert.equal((await send("/api/events", event)).status, 204);
    assert.equal((await send("/api/events", event)).status, 204);
    const storedEvent = await sql`SELECT path, is_test FROM conversion_events WHERE id = ${eventId}`;
    assert.equal(storedEvent.length, 1); assert.equal(storedEvent[0].path, "/products/syrah-cork-sunglasses");
    const login = await send("/api/admin/login", { password: process.env.ADMIN_PASSWORD });
    assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0];
    const report = await fetch(base + "/api/admin/conversions", { headers: { Cookie: cookie } }); assert.equal(report.status, 200);
    assert.equal((await report.json()).enquiries.some(e => e.id === leadId), false);
    const patch = await fetch(base + "/api/admin/conversions", { method: "PATCH", headers: { Origin: base, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ id: leadId, status: "qualified" }) });
    assert.equal(patch.status, 200); assert.equal((await sql`SELECT status FROM vineyard_enquiries WHERE id = ${leadId}`)[0].status, "qualified");
    const catalog = await (await fetch(base + "/api/storefront")).json();
    const tee = catalog.products.find(p => p.handle === "it-s-always-sunny-in-space-minimal-logo-tee"), variant = tee.variants.find(v => v.title === "2XL");
    const line = { productId: tee.id, productHandle: tee.handle, variantId: variant.id, quantity: 2 };
    assert.equal((await send("/api/checkout", { lines: [{ ...line, quantity: 11 }] })).status, 400);
    const unavailable = catalog.products.find(p => !p.available);
    assert.equal((await send("/api/checkout", { lines: [{ productId: unavailable.id, productHandle: unavailable.handle, variantId: unavailable.variants[0].id, quantity: 1 }] })).status, 400);
    const checkout = await send("/api/checkout", { lines: [line], analyticsSessionId: visit }); assert.equal(checkout.status, 200);
    const result = await checkout.json(); session = await stripe.checkout.sessions.retrieve(result.sessionId, { expand: ["line_items"] });
    assert.equal(session.livemode, false); assert.equal(session.amount_subtotal, Math.round(variant.price * 100) * 2);
    assert.equal(session.line_items.data[0].quantity, 2); assert.equal(session.line_items.data[0].price.unit_amount, 2650);
    assert.equal(session.amount_total, 5300 + catalog.shippingCents); assert.equal(session.metadata.analytics_session_id, visit);
    const unpaid = await (await fetch(base + "/order/success?session_id=" + session.id)).text();
    assert.ok(unpaid.includes("We haven&#x27;t confirmed") || unpaid.includes("We haven&#39;t confirmed") || unpaid.includes("We haven't confirmed"));
    // Simulate a signed TEST event on localhost. No real card charge or Printful production.
    const object = { ...session, payment_status: "paid", collected_information: { shipping_details: { name: "Conversion QA", address: { line1: "1 Test Street", city: "Austin", state: "TX", postal_code: "78701", country: "US" } } }, customer_details: { email: "conversion-qa@example.com" } };
    const payload = JSON.stringify({ id: "evt_qa_" + randomUUID(), object: "event", type: "checkout.session.completed", livemode: false, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
    for (let retry = 0; retry < 2; retry++) { const webhook = await fetch(base + "/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: payload }); assert.equal(webhook.status, 200); }
    const order = (await sql`SELECT checkout_status, fulfillment_status FROM storefront_orders WHERE stripe_session_id = ${session.id}`)[0];
    // The handler retrieves the authoritative session from Stripe; an unpaid
    // test session must remain unpaid even if a signed fixture claims payment.
    assert.equal(order.checkout_status, "payment_pending"); assert.equal(order.fulfillment_status, "pending");
    const purchases = await sql`SELECT id, is_test FROM conversion_events WHERE id = ${'purchase:' + session.metadata.order_id}`;
    assert.equal(purchases.length, 0);
    const invalidSuccess = await (await fetch(base + "/order/success")).text(); assert.ok(!invalidSuccess.includes('Your payment was received. Thank'));
  } finally {
    if (session) { await stripe.checkout.sessions.expire(session.id).catch(() => undefined); await sql`DELETE FROM conversion_events WHERE id IN (${'purchase:' + session.metadata.order_id}, ${'checkout:' + session.metadata.order_id}) AND is_test = TRUE`; await sql`DELETE FROM storefront_orders WHERE stripe_session_id = ${session.id} AND stripe_session_id LIKE 'cs_test_%'`; }
    await sql`DELETE FROM conversion_events WHERE session_id = ${visit} AND is_test = TRUE`;
    await sql`DELETE FROM vineyard_enquiries WHERE id = ${leadId} AND is_test = TRUE`;
  }
});
