import type { OrderLine } from "../../db/orders";
import { DAVIDS_PRINTFUL_STORE_ID } from "../../db/synced-products";

type ShippingDetails = {
  name: string;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  };
};

type PrintfulOrder = {
  id: number | string;
  external_id: string | null;
  status: string;
  error?: string | { message?: string } | null;
};

type PrintfulResponse = {
  code?: number;
  result?: PrintfulOrder;
  error?: string | { message?: string; reason?: string };
};

function printfulConfig(storeId: string) {
  const token = process.env.PRINTFUL_TOKEN?.trim();
  const legacyStoreId = process.env.PRINTFUL_STORE_ID?.trim();
  if (!token) throw new Error("PRINTFUL_TOKEN is not configured.");
  if (!legacyStoreId) throw new Error("PRINTFUL_STORE_ID is not configured.");
  if (![legacyStoreId, DAVIDS_PRINTFUL_STORE_ID].includes(storeId)) {
    throw new Error("The requested Printful store is not configured for fulfillment.");
  }
  return { token, storeId };
}

function errorMessage(body: PrintfulResponse, status: number) {
  const error = body.error;
  if (typeof error === "string") return error;
  return error?.message ?? error?.reason ?? `Printful returned HTTP ${status}.`;
}

async function printfulRequest(storeId: string, path: string, init?: RequestInit) {
  const { token } = printfulConfig(storeId);
  const response = await fetch(`https://api.printful.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-PF-Store-Id": storeId,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json()) as PrintfulResponse;
  return { response, body };
}

async function findExistingOrder(storeId: string, externalId: string) {
  const encodedId = encodeURIComponent(`@${externalId}`);
  const { response, body } = await printfulRequest(storeId, `/orders/${encodedId}`);
  if (response.status === 404) return null;
  if (!response.ok || !body.result) {
    throw new Error(errorMessage(body, response.status));
  }
  return body.result;
}

function orderWasSubmitted(order: PrintfulOrder) {
  return !["draft", "failed", "canceled"].includes(order.status.toLowerCase());
}

async function confirmOrder(storeId: string, externalId: string) {
  const encodedId = encodeURIComponent(`@${externalId}`);
  const { response, body } = await printfulRequest(
    storeId,
    `/orders/${encodedId}/confirm`,
    { method: "POST" },
  );
  if (!response.ok || !body.result) {
    throw new Error(errorMessage(body, response.status));
  }
  return body.result;
}

export async function submitPrintfulOrder({
  orderId,
  storeId,
  lines,
  shipping,
  email,
  phone,
}: {
  orderId: string;
  storeId: string;
  lines: OrderLine[];
  shipping: ShippingDetails;
  email: string | null;
  phone: string | null;
}) {
  if (lines.length === 0) throw new Error("No Printful items were supplied.");

  const address = shipping.address;
  if (
    !shipping.name ||
    !address.line1 ||
    !address.city ||
    !address.state ||
    !address.postal_code ||
    !address.country
  ) {
    throw new Error("The paid order is missing a complete shipping address.");
  }

  printfulConfig(storeId);
  if (lines.some((line) => line.printfulStoreId && line.printfulStoreId !== storeId)) {
    throw new Error("Printful order lines were assigned to different stores.");
  }

  const externalId =
    storeId === process.env.PRINTFUL_STORE_ID?.trim()
      ? `vs-${orderId}`
      : `vs-${orderId}-${storeId}`;
  const existing = await findExistingOrder(storeId, externalId);
  if (existing) {
    if (orderWasSubmitted(existing)) return existing;
    if (existing.status.toLowerCase() === "canceled") {
      throw new Error("The matching Printful order was canceled.");
    }
    const confirmed = await confirmOrder(storeId, externalId);
    if (!orderWasSubmitted(confirmed)) {
      throw new Error(`Printful order is ${confirmed.status}.`);
    }
    return confirmed;
  }

  const payload = {
    external_id: externalId,
    shipping: process.env.PRINTFUL_SHIPPING_METHOD?.trim() || "STANDARD",
    recipient: {
      name: shipping.name,
      address1: address.line1,
      address2: address.line2 || undefined,
      city: address.city,
      state_code: address.state,
      country_code: address.country,
      zip: address.postal_code,
      email: email || undefined,
      phone: phone || undefined,
    },
    items: lines.map((line) => {
      const variantId = line.printfulVariantId ?? String(line.variantId);
      const variantReference = line.printfulVariantReference ?? "external";
      return {
        external_id: `${orderId}-${line.variantId}`,
        ...(variantReference === "sync"
          ? { sync_variant_id: Number(variantId) }
          : { external_variant_id: variantId }),
        quantity: line.quantity,
        retail_price: (line.unitAmountCents / 100).toFixed(2),
      };
    }),
  };

  const { response, body } = await printfulRequest(
    storeId,
    "/orders?confirm=1&update_existing=true",
    { method: "POST", body: JSON.stringify(payload) },
  );

  if (!response.ok || !body.result) {
    // A simultaneous Stripe delivery can race the initial lookup. The external
    // order ID lets us safely recover the one Printful order instead of making
    // another one.
    const racedOrder = await findExistingOrder(storeId, externalId);
    if (racedOrder && orderWasSubmitted(racedOrder)) return racedOrder;
    throw new Error(errorMessage(body, response.status));
  }

  if (!orderWasSubmitted(body.result)) {
    const detail =
      typeof body.result.error === "string"
        ? body.result.error
        : body.result.error?.message;
    throw new Error(detail || `Printful order is ${body.result.status}.`);
  }

  return body.result;
}
