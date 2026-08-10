"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./success.module.css";

const CART_STORAGE_KEY = "vineyard-sun-cart-v1";

export function OrderSuccessClient({
  orderNumber,
  testMode,
}: {
  orderNumber: string | null;
  testMode: boolean;
}) {
  useEffect(() => {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.wordmark} href="/">
          VINEYARD <span>SUN</span>
        </Link>
        <p className={styles.eyebrow}>Order received</p>
        <h1>Thank you.</h1>
        <p className={styles.copy}>
          Your payment was received. A receipt is on its way to your email, and
          made-to-order pieces will move directly into production.
        </p>
        {orderNumber && <p className={styles.order}>Order {orderNumber}</p>}
        {testMode && (
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
