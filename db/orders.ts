import { getDb } from ".";

export type OrderLine = {
  productId: number;
  variantId: number;
  productTitle: string;
  productHandle: string;
  variantTitle: string;
  quantity: number;
  unitAmountCents: number;
  fulfillment: "local" | "printful";
  sku: string | null;
};

export type StorefrontOrder = {
  id: string;
  stripeSessionId: string | null;
  checkoutStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  cart: OrderLine[];
  customerEmail: string | null;
  shippingAddress: unknown;
  printfulOrderId: string | null;
  printfulStatus: string | null;
  lastError: string | null;
};

type OrderRow = {
  id: string;
  stripe_session_id: string | null;
  checkout_status: string;
  fulfillment_status: string;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  cart: unknown;
  customer_email: string | null;
  shipping_address: unknown;
  printful_order_id: string | null;
  printful_status: string | null;
  last_error: string | null;
};

let schemaReady: Promise<unknown> | undefined;

async function ensureSchema() {
  const sql = getDb();

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS storefront_orders (
        id TEXT PRIMARY KEY,
        stripe_session_id TEXT UNIQUE,
        stripe_payment_intent_id TEXT,
        checkout_status TEXT NOT NULL DEFAULT 'creating',
        fulfillment_status TEXT NOT NULL DEFAULT 'pending',
        currency TEXT NOT NULL DEFAULT 'usd',
        subtotal_cents INTEGER NOT NULL,
        shipping_cents INTEGER NOT NULL DEFAULT 0,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL,
        cart JSONB NOT NULL,
        customer_email TEXT,
        shipping_address JSONB,
        printful_order_id TEXT,
        printful_status TEXT,
        last_error TEXT,
        processing_started_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS storefront_orders_created_at_idx
      ON storefront_orders (created_at DESC)
    `;
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });

  await schemaReady;
}

function mapOrder(row: OrderRow): StorefrontOrder {
  return {
    id: row.id,
    stripeSessionId: row.stripe_session_id,
    checkoutStatus: row.checkout_status,
    fulfillmentStatus: row.fulfillment_status,
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    cart: Array.isArray(row.cart) ? (row.cart as OrderLine[]) : [],
    customerEmail: row.customer_email,
    shippingAddress: row.shipping_address,
    printfulOrderId: row.printful_order_id,
    printfulStatus: row.printful_status,
    lastError: row.last_error,
  };
}

export async function createStorefrontOrder({
  id,
  cart,
  subtotalCents,
  shippingCents,
}: {
  id: string;
  cart: OrderLine[];
  subtotalCents: number;
  shippingCents: number;
}) {
  const sql = getDb();
  await ensureSchema();
  const cartJson = JSON.stringify(cart);

  await sql`
    INSERT INTO storefront_orders (
      id, checkout_status, fulfillment_status, currency,
      subtotal_cents, shipping_cents, total_cents, cart
    )
    VALUES (
      ${id}, 'creating', 'pending', 'usd',
      ${subtotalCents}, ${shippingCents}, ${subtotalCents + shippingCents},
      ${cartJson}::jsonb
    )
  `;
}

export async function attachStripeSession(orderId: string, sessionId: string) {
  const sql = getDb();
  await ensureSchema();
  await sql`
    UPDATE storefront_orders
    SET stripe_session_id = ${sessionId}, checkout_status = 'open', updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function markCheckoutCreationFailed(orderId: string, error: string) {
  const sql = getDb();
  await ensureSchema();
  await sql`
    UPDATE storefront_orders
    SET checkout_status = 'creation_failed', last_error = ${error.slice(0, 2000)}, updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function recordPaidCheckout({
  orderId,
  sessionId,
  paymentIntentId,
  email,
  shippingAddress,
  subtotalCents,
  shippingCents,
  taxCents,
  totalCents,
}: {
  orderId: string;
  sessionId: string;
  paymentIntentId: string | null;
  email: string | null;
  shippingAddress: unknown;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}) {
  const sql = getDb();
  await ensureSchema();
  const shippingJson = JSON.stringify(shippingAddress);
  const rows = (await sql`
    UPDATE storefront_orders
    SET checkout_status = 'paid',
        stripe_payment_intent_id = ${paymentIntentId},
        customer_email = ${email},
        shipping_address = ${shippingJson}::jsonb,
        subtotal_cents = ${subtotalCents},
        shipping_cents = ${shippingCents},
        tax_cents = ${taxCents},
        total_cents = ${totalCents},
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
    WHERE id = ${orderId} AND stripe_session_id = ${sessionId}
    RETURNING *
  `) as OrderRow[];

  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function claimOrderForFulfillment(orderId: string) {
  const sql = getDb();
  await ensureSchema();
  const rows = (await sql`
    UPDATE storefront_orders
    SET fulfillment_status = 'processing',
        processing_started_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
    WHERE id = ${orderId}
      AND checkout_status = 'paid'
      AND (
        fulfillment_status IN ('pending', 'failed')
        OR (
          fulfillment_status = 'processing'
          AND processing_started_at < NOW() - INTERVAL '10 minutes'
        )
      )
    RETURNING *
  `) as OrderRow[];

  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function markPrintfulSubmitted({
  orderId,
  printfulOrderId,
  printfulStatus,
  hasLocalItems,
}: {
  orderId: string;
  printfulOrderId: string;
  printfulStatus: string;
  hasLocalItems: boolean;
}) {
  const sql = getDb();
  await ensureSchema();
  const fulfillmentStatus = hasLocalItems
    ? "printful_submitted_local_pending"
    : "printful_submitted";
  await sql`
    UPDATE storefront_orders
    SET fulfillment_status = ${fulfillmentStatus},
        printful_order_id = ${printfulOrderId},
        printful_status = ${printfulStatus},
        last_error = NULL,
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function markFulfillmentState({
  orderId,
  status,
  error = null,
}: {
  orderId: string;
  status: "failed" | "local_pending" | "test_skipped";
  error?: string | null;
}) {
  const sql = getDb();
  await ensureSchema();
  await sql`
    UPDATE storefront_orders
    SET fulfillment_status = ${status},
        last_error = ${error?.slice(0, 2000) ?? null},
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function markCheckoutStatus(sessionId: string, status: string) {
  const sql = getDb();
  await ensureSchema();
  await sql`
    UPDATE storefront_orders
    SET checkout_status = ${status}, updated_at = NOW()
    WHERE stripe_session_id = ${sessionId} AND checkout_status <> 'paid'
  `;
}

export async function getOrderByStripeSession(sessionId: string) {
  const sql = getDb();
  await ensureSchema();
  const rows = (await sql`
    SELECT * FROM storefront_orders
    WHERE stripe_session_id = ${sessionId}
    LIMIT 1
  `) as OrderRow[];
  return rows[0] ? mapOrder(rows[0]) : null;
}
