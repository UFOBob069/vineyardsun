import type Stripe from "stripe";
import { submitPrintfulOrder } from "../../../lib/printful";
import { getStripe, getWebhookSecret } from "../../../lib/stripe";
import {
  claimOrderForFulfillment,
  markCheckoutStatus,
  markFulfillmentState,
  markPrintfulSubmitted,
  recordPaidCheckout,
} from "../../../../db/orders";

export const runtime = "nodejs";
export const maxDuration = 30;

function expandableId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function fulfillPaidSession(session: Stripe.Checkout.Session) {
  if (!session.payment_status || !["paid", "no_payment_required"].includes(session.payment_status)) {
    await markCheckoutStatus(session.id, "payment_pending");
    return;
  }

  const orderId = session.metadata?.order_id || session.client_reference_id;
  if (!orderId) throw new Error("Paid Stripe session has no Vineyard Sun order ID.");

  const shipping = session.collected_information?.shipping_details;
  if (!shipping) throw new Error("Paid Stripe session has no shipping address.");

  const order = await recordPaidCheckout({
    orderId,
    sessionId: session.id,
    paymentIntentId: expandableId(session.payment_intent),
    email: session.customer_details?.email ?? null,
    shippingAddress: shipping,
    subtotalCents: session.amount_subtotal ?? 0,
    shippingCents: session.total_details?.amount_shipping ?? 0,
    taxCents: session.total_details?.amount_tax ?? 0,
    totalCents: session.amount_total ?? 0,
  });
  if (!order) throw new Error("Paid Stripe session did not match a stored order.");

  // The production Printful account is real even while Stripe uses test mode.
  // Never manufacture a test purchase unless the owner explicitly opts in.
  if (!session.livemode && process.env.PRINTFUL_ALLOW_TEST_ORDERS !== "true") {
    await markFulfillmentState({ orderId, status: "test_skipped" });
    return;
  }

  const claimed = await claimOrderForFulfillment(orderId);
  if (!claimed) return;

  const printfulLines = claimed.cart.filter((line) => line.fulfillment === "printful");
  const hasLocalItems = claimed.cart.some((line) => line.fulfillment === "local");
  if (printfulLines.length === 0) {
    await markFulfillmentState({ orderId, status: "local_pending" });
    return;
  }

  try {
    const printfulOrder = await submitPrintfulOrder({
      orderId,
      lines: printfulLines,
      shipping,
      email: session.customer_details?.email ?? null,
      phone: session.customer_details?.phone ?? null,
    });
    await markPrintfulSubmitted({
      orderId,
      printfulOrderId: String(printfulOrder.id),
      printfulStatus: printfulOrder.status,
      hasLocalItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Printful fulfillment failed.";
    await markFulfillmentState({ orderId, status: "failed", error: message });
    throw error;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature.", { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSecret(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature.";
    console.warn("Rejected Stripe webhook", { message });
    return new Response("Invalid Stripe signature.", { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const eventSession = event.data.object as Stripe.Checkout.Session;
      const session = await getStripe().checkout.sessions.retrieve(eventSession.id);
      await fulfillPaidSession(session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await markCheckoutStatus(session.id, "payment_failed");
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await markCheckoutStatus(session.id, "expired");
    }

    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    console.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      message,
    });
    // A non-2xx response asks Stripe to retry transient database or Printful failures.
    return new Response("Webhook processing failed.", { status: 500 });
  }
}
