import { retailDeliveryTiming } from "../lib/merchant-policies";

export function ShippingNote({ shippingCents, madeToOrder = false }: { shippingCents: number; madeToOrder?: boolean }) {
  const { handling, transit, total } = retailDeliveryTiming(madeToOrder);
  return <div className="shipping-note"><p><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(shippingCents / 100)} flat US shipping</strong> · Estimated delivery: {total.min}–{total.max} business days.</p><p>{madeToOrder ? "Made to order" : "Dispatched from our studio"} in {handling.min}–{handling.max} business days, plus {transit.min}–{transit.max} business days for shipping. {madeToOrder ? "Mixed orders may arrive separately." : "Contact us before ordering if you need it by a specific date."}</p><a href="/shipping-returns">30-day consumer returns</a><p>You pay return postage unless your item arrives damaged or incorrect; then we cover it.</p></div>;
}
