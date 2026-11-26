import type { Metadata } from "next";
import { getOrderByStripeSession } from "../../../db/orders";
import { OrderSuccessClient } from "./OrderSuccessClient";
import { getStripe } from "../../lib/stripe";

export const metadata: Metadata = {
  title: "Order received | Vineyard Sun",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const validSessionId =
    typeof sessionId === "string" && /^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId)
      ? sessionId
      : null;
  const order = validSessionId
    ? await getOrderByStripeSession(validSessionId).catch(() => null)
    : null;

  let confirmed = order?.checkoutStatus === "paid";
  if (order && !confirmed && validSessionId) {
    const session = await getStripe().checkout.sessions.retrieve(validSessionId).catch(() => null);
    confirmed = Boolean(session && session.metadata?.order_id === order.id && ["paid", "no_payment_required"].includes(session.payment_status));
  }
  return (
    <OrderSuccessClient
      orderNumber={order ? order.id.slice(0, 8).toUpperCase() : null}
      testMode={Boolean(validSessionId?.startsWith("cs_test_"))}
      confirmed={confirmed}
      sessionId={validSessionId}
      purchased={confirmed ? order?.cart ?? [] : []}
      canRefresh={Boolean(order)}
    />
  );
}
