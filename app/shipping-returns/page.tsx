import Link from "next/link";
import type { Metadata } from "next";
import { ShopHeader } from "../components/ShopHeader";
import { configuredShippingCents } from "../lib/shipping";
import { CONSUMER_RETURN_DAYS } from "../lib/merchant-policies";
export const metadata: Metadata = { title: "Shipping & returns | Vineyard Sun", alternates: { canonical: "https://www.vineyardsun.com/shipping-returns" } };
export default function ShippingReturns() {
  const shipping = (configuredShippingCents() / 100).toFixed(2);
  return <div className="site-shell"><ShopHeader /><main className="information-page"><p className="eyebrow">A little peace of mind</p><h1>Shipping &amp; returns.</h1>
    <h2>Consumer orders</h2><p>Standard shipping is ${shipping} USD per order within the United States. Any applicable tax is shown at checkout. The current standard delivery estimate is 4–12 business days; this is an estimate, not a guaranteed arrival date.</p><p>Stocked sunglasses and our embroidered pillow ship from our studio. Made-to-order items are produced after you order and may ship separately. If you have an event or gift deadline, please contact us before ordering so we can discuss timing.</p>
    <h2>{CONSUMER_RETURN_DAYS}-day returns</h2><p>For consumer purchases, contact us within {CONSUMER_RETURN_DAYS} days of delivery to arrange a return. Email <a href="mailto:info@vineyardsun.com">info@vineyardsun.com</a> with your order number and the item you&apos;d like to return. We&apos;ll provide return instructions and explain any return-shipping arrangements before you send anything back.</p><p>If your order arrives damaged or incorrect, let us know what happened. We&apos;ll work with you to put it right. Photos can help us understand the issue.</p>
    <h2>Custom vineyard &amp; wholesale orders</h2><p>Custom projects are quoted separately and aren&apos;t purchased through the retail checkout. We agree the design, quantity, delivery arrangements, and applicable return or cancellation terms with you before you approve the order. If there&apos;s a problem with an order, contact us so we can work through a solution.</p><Link className="button button-dark" href="/custom-vineyard-sunglasses#enquire">Discuss a vineyard project ↗</Link>
    <p><Link href="/#catalog">Back to the collection →</Link></p></main></div>;
}
