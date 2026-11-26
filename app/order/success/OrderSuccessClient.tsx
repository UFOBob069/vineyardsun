"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./success.module.css";
import { useRouter } from "next/navigation";
import { useCart } from "../../components/CartProvider";
import type { CartLine } from "../../lib/cart";

export function OrderSuccessClient({
  orderNumber,
  testMode,
  confirmed,
  sessionId,
  purchased,
  canRefresh,
}: {
  orderNumber: string | null;
  testMode: boolean;
  confirmed: boolean;
  sessionId: string | null;
  purchased: CartLine[];
  canRefresh: boolean;
}) {
  const { complete, ready } = useCart();
  const router = useRouter();
  useEffect(() => {
    if (confirmed && sessionId && ready) complete(sessionId, purchased);
  }, [confirmed, sessionId, purchased, ready, complete]);
  useEffect(() => {
    if (confirmed || !canRefresh) return;
    const timer = setTimeout(() => router.refresh(), 5000);
    return () => clearTimeout(timer);
  }, [confirmed, canRefresh, router]);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.wordmark} href="/">
          VINEYARD <span>SUN</span>
        </Link>
        <p className={styles.eyebrow}>{confirmed ? "Order received" : "Payment confirmation"}</p>
        <h1>{confirmed ? "Thank you." : "Let's check your order."}</h1>
        <p className={styles.copy}>
          {confirmed ? "Your payment was received. Thank you for shopping with Vineyard Sun. Stocked items will be prepared for shipping; made-to-order pieces will move into production." : "We haven't confirmed a completed payment for this visit. Your bag has been kept. If you just paid, check the status again in a moment; contact us if you need help."}
        </p>
        {orderNumber && <p className={styles.order}>Order {orderNumber}</p>}
        {!confirmed && canRefresh && <button className={styles.button} onClick={() => router.refresh()}>Check payment status</button>}
        {testMode && confirmed && (
          <p className={styles.testNote}>
            This was a Stripe test checkout, so Printful production was safely skipped.
          </p>
        )}
        <Link className={styles.button} href="/">
          Return to Vineyard Sun
        </Link>
      </section>
    </main>
  );
}
