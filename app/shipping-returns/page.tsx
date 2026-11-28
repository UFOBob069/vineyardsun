import Link from "next/link";
import type { Metadata } from "next";
import { ShopHeader } from "../components/ShopHeader";
import { configuredShippingCents } from "../lib/shipping";
import { CONSUMER_RETURN_DAYS, retailDeliveryTiming } from "../lib/merchant-policies";
export const metadata: Metadata = { title: "Shipping & returns | Vineyard Sun", alternates: { canonical: "https://www.vineyardsun.com/shipping-returns" } };
export default function ShippingReturns() {
  const shipping = (configuredShippingCents() / 100).toFixed(2);
  const stocked = retailDeliveryTiming(false), madeToOrder = retailDeliveryTiming(true);
  return <div className="site-shell"><ShopHeader /><main className="information-page"><p className="eyebrow">A little peace of mind</p><h1>Shipping &amp; returns.</h1>
    <h2>Consumer orders</h2><p>Standard shipping is ${shipping} USD per order within the United States. Any applicable tax is shown at checkout. The overall standard delivery estimate is 4–12 business days; this is an estimate, not a guaranteed arrival date.</p>
    <p><strong>Stocked sunglasses and pillows:</strong> dispatched from our studio within {stocked.handling.min}–{stocked.handling.max} business days, followed by {stocked.transit.min}–{stocked.transit.max} business days for shipping. Estimated total: {stocked.total.min}–{stocked.total.max} business days.</p>
    <p><strong>Made-to-order products:</strong> allow {madeToOrder.handling.min}–{madeToOrder.handling.max} business days for production and dispatch, followed by {madeToOrder.transit.min}–{madeToOrder.transit.max} business days for shipping. Estimated total: {madeToOrder.total.min}–{madeToOrder.total.max} business days. These items are produced after you order and may ship separately.</p>
    <p>Business days are Monday through Friday, excluding public holidays. If you have an event or gift deadline, please contact us before ordering so we can discuss timing.</p>
    <h2>{CONSUMER_RETURN_DAYS}-day returns</h2><p>For consumer purchases, contact us within {CONSUMER_RETURN_DAYS} days of delivery to arrange a return. Email <a href="mailto:info@vineyardsun.com">info@vineyardsun.com</a> with your order number and the item you&apos;d like to return. We&apos;ll provide return instructions before you send anything back. Customers pay return postage unless the item arrives damaged or incorrect, in which case we cover it.</p><p>If your order arrives damaged or incorrect, let us know what happened. We&apos;ll work with you to put it right. Photos can help us understand the issue.</p>
    <h2>Custom vineyard &amp; wholesale orders</h2><p>Custom projects are quoted separately and aren&apos;t purchased through the retail checkout. We agree the design, quantity, delivery arrangements, and applicable return or cancellation terms with you before you approve the order. If there&apos;s a problem with an order, contact us so we can work through a solution.</p><Link className="button button-dark" href="/custom-vineyard-sunglasses#enquire">Discuss a vineyard project ↗</Link>
    <p><Link href="/#catalog">Back to the collection →</Link></p></main></div>;
}
