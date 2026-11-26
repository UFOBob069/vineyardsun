import { getPublicCatalog } from "../../lib/public-catalog";
import { configuredShippingCents } from "../../lib/shipping";
export async function GET() {
  try { return Response.json({ products: await getPublicCatalog(), shippingCents: configuredShippingCents() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "We couldn't refresh your bag. Please try again." }, { status: 503 }); }
}
