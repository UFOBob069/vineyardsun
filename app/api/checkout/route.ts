import { configuredShippingCents, deliveryEstimate } from "../../lib/shipping";
import { recordConversion, isConversionTest } from "../../../db/conversions";
import { sessionId as parseSessionId } from "../../lib/conversion-validation";
import type Stripe from "stripe";
import { getMerchandisingSettings } from "../../../db/merchandising";
import {
  attachStripeSession,
  createStorefrontOrder,
  markCheckoutCreationFailed,
  type OrderLine,
} from "../../../db/orders";
import {
  catalog,
  cents,
  findCatalogVariant,
  productIsInStorefrontCatalog,
} from "../../lib/catalog";
import { getStripe } from "../../lib/stripe";
import { getSyncedCatalogProducts } from "../../../db/synced-products";

export const runtime = "nodejs";
export const maxDuration = 30;

type RequestedLine = {
  productId: number;
  variantId: number;
  productHandle: string;
  quantity: number;
};

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseRequestedLines(value: unknown): RequestedLine[] {
  if (!value || typeof value !== "object") throw new Error("Invalid request.");
  const lines = (value as { lines?: unknown }).lines;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50) {
    throw new Error("Your bag must contain between 1 and 50 items.");
  }

  const combined = new Map<string, RequestedLine>();
  for (const line of lines) {
    if (!line || typeof line !== "object") throw new Error("Invalid bag item.");
    const candidate = line as Partial<RequestedLine>;
    if (
      !positiveInteger(candidate.productId) ||
      !positiveInteger(candidate.variantId) ||
      typeof candidate.productHandle !== "string" ||
      !candidate.productHandle.trim() ||
      candidate.productHandle.length > 140 ||
      !positiveInteger(candidate.quantity) ||
      candidate.quantity! > 10
    ) {
      throw new Error("Invalid bag quantity or product.");
    }

    const key = `${candidate.productHandle}:${candidate.productId}:${candidate.variantId}`;
    const previous = combined.get(key);
    const quantity = (previous?.quantity ?? 0) + candidate.quantity!;
    if (quantity > 10) throw new Error("A product quantity cannot exceed 10.");
    combined.set(key, {
      productId: candidate.productId!,
      variantId: candidate.variantId!,
      productHandle: candidate.productHandle,
      quantity,
    });
  }

  return [...combined.values()];
}

function siteOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let analyticsSessionId: string | null = null;
  let orderId: string | null = null;

  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const payload = await request.json();
    analyticsSessionId = parseSessionId(payload?.analyticsSessionId);
    const requestedLines = parseRequestedLines(payload);
    const [{ hiddenProductHandles }, syncedProducts] = await Promise.all([
      getMerchandisingSettings(),
      getSyncedCatalogProducts(),
    ]);
    const products = [...catalog, ...syncedProducts];
    const hiddenHandles = new Set(hiddenProductHandles);
    const orderLines: OrderLine[] = requestedLines.map((line) => {
      const match = findCatalogVariant(
        line.productId,
        line.variantId,
        products,
        line.productHandle,
      );
      if (
        !match ||
        !match.product.available ||
        !match.variant.available ||
        hiddenHandles.has(match.product.handle) ||
        (match.product.source !== "printful-api" &&
          !productIsInStorefrontCatalog(match.product.handle))
      ) {
        throw new Error("One of the selected products is no longer available.");
      }

      return {
        productId: match.product.id,
        variantId: match.variant.id,
        productTitle: match.product.title,
        productHandle: match.product.handle,
        variantTitle: match.variant.title,
        quantity: line.quantity,
        unitAmountCents: cents(match.variant.price),
        fulfillment: match.product.fulfillment,
        sku: match.variant.sku,
        printfulStoreId:
          match.product.fulfillment === "printful"
            ? match.product.printfulStoreId ?? process.env.PRINTFUL_STORE_ID?.trim()
            : undefined,
        printfulVariantId:
          match.product.fulfillment === "printful"
            ? match.variant.printfulVariantId ?? String(match.variant.id)
            : undefined,
        printfulVariantReference:
          match.product.fulfillment === "printful"
            ? match.variant.printfulVariantReference ?? "external"
            : undefined,
      };
    });

    const subtotalCents = orderLines.reduce(
      (sum, line) => sum + line.unitAmountCents * line.quantity,
      0,
    );
    const shippingCents = configuredShippingCents();
    orderId = crypto.randomUUID();
    await createStorefrontOrder({
      id: orderId,
      cart: orderLines,
      subtotalCents,
      shippingCents,
    });

    const origin = siteOrigin(request);
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = orderLines.map(
      (line) => ({
        quantity: line.quantity,
        price_data: {
          currency: "usd",
          unit_amount: line.unitAmountCents,
          product_data: {
            name: line.productTitle,
            description:
              line.variantTitle === "Default Title" ? undefined : line.variantTitle,
            metadata: {
              product_handle: line.productHandle,
              variant_id: String(line.variantId),
              fulfillment: line.fulfillment,
            },
          },
        },
      }),
    );

    const session = await getStripe().checkout.sessions.create(
      {
        integration_identifier: "vineyard_sun_storefront_nxqvhkma",
        mode: "payment",
        client_reference_id: orderId,
        customer_creation: "always",
        line_items: lineItems,
        billing_address_collection: "auto",
        shipping_address_collection: { allowed_countries: ["US"] },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: "Standard shipping",
              fixed_amount: { amount: shippingCents, currency: "usd" },
              delivery_estimate: deliveryEstimate,
            },
          },
        ],
        phone_number_collection: { enabled: true },
        allow_promotion_codes: true,
        automatic_tax: {
          enabled: process.env.STRIPE_AUTOMATIC_TAX === "true",
        },
        success_url: `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?checkout=cancelled#catalog`,
        metadata: { order_id: orderId, ...(analyticsSessionId ? { analytics_session_id: analyticsSessionId } : {}) },
        payment_intent_data: { metadata: { order_id: orderId } },
      },
      { idempotencyKey: `vineyard-sun-checkout-${orderId}` },
    );

    if (!session.url) throw new Error("Stripe did not provide a checkout URL.");
    await attachStripeSession(orderId, session.id);
    await recordConversion({ id: `checkout:${orderId}`, sessionId: analyticsSessionId, name: "checkout_started", funnel: "retail", path: "/", valueCents: subtotalCents, isTest: !session.livemode || isConversionTest() }).catch(() => undefined);
    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    if (orderId) await markCheckoutCreationFailed(orderId, message).catch(() => undefined);
    console.error("Checkout session creation failed", { orderId, message });
    await recordConversion({ id: `checkout-error:${crypto.randomUUID()}`, sessionId: analyticsSessionId, name: "checkout_error", funnel: "retail", path: "/", isTest: isConversionTest() || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") }).catch(() => undefined);
    const clientMessage = message.startsWith("One of the selected")
      ? message
      : "Checkout could not start. Please try again.";
    return Response.json({ error: clientMessage }, { status: 400 });
  }
}
