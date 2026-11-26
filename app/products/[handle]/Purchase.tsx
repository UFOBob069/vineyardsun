"use client";
import Link from "next/link";

import { useState } from "react";
import type { CatalogProduct, CatalogVariant } from "../../lib/catalog";
import { useCart } from "../../components/CartProvider";

export function Purchase({ product, variant }: { product: CatalogProduct; variant: CatalogVariant }) {
  const [quantity, setQuantity] = useState(1);
  const { ready, add, checkout, pending, error } = useCart();
  const available = product.available && variant.available;
  return <div className="purchase-controls">
    {available && <label className="purchase-quantity">Quantity<select value={quantity} onChange={e => setQuantity(Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>}
    <button className="button button-dark button-wide" disabled={!ready || pending || !available} onClick={() => add(product, variant, quantity)}>{available ? "Add to bag" : "Sold out"}</button>
    {available && <button className="button buy-now button-wide" disabled={!ready || pending} onClick={() => checkout([{ productId: product.id, productHandle: product.handle, variantId: variant.id, quantity }], "direct")}>{pending ? "Opening checkout…" : "Buy now"}</button>}
    {!available && <Link href="/products/syrah-cork-sunglasses">Explore Syrah sunglasses →</Link>}
    {error && <p className="checkout-error" role="alert">{error}</p>}
  </div>;
}
