import type { Metadata } from "next";
import { getOrderByStripeSession } from "../../../db/orders";
import { OrderSuccessClient } from "./OrderSuccessClient";

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

  return (
    <OrderSuccessClient
      orderNumber={order ? order.id.slice(0, 8).toUpperCase() : null}
      testMode={Boolean(validSessionId?.startsWith("cs_test_"))}
    />
  );
}
