"use client";

import { useState } from "react";
import type { CatalogProduct, CatalogVariant } from "../../lib/catalog";

export function Purchase({ product, variant }: { product: CatalogProduct; variant: CatalogVariant }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function checkout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: [{ productId: product.id, productHandle: product.handle, variantId: variant.id, quantity: 1 }] }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not start. Please try again.");
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not start. Please try again.");
      setPending(false);
    }
  }
  return <>
    <button className="button button-dark button-wide" onClick={checkout} disabled={pending || !product.available || !variant.available}>
      {!product.available || !variant.available ? "Sold out" : pending ? "Opening checkout…" : "Buy now"}
    </button>
    {error && <p role="alert">{error}</p>}
  </>;
}
