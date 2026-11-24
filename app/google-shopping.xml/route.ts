import { getPublicCatalog, productUrl, SITE_URL } from "../lib/public-catalog";
import { googleCategory, googleDetails, xml } from "../lib/google-products";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getPublicCatalog();
    const shipping = Number.parseInt(process.env.SHIPPING_RATE_CENTS || "595", 10);
    if (!Number.isSafeInteger(shipping) || shipping < 0 || shipping > 100_000) throw new Error("Invalid shipping rate");
    const tag = (name: string, value: string | number) => `<g:${name}>${xml(value)}</g:${name}>`;
    const items = products.flatMap((product) => product.variants.flatMap((variant) => {
      const detail = googleDetails(product, variant);
      const category = googleCategory(product);
      const apparel = category.startsWith("Apparel");
      // New apparel stays out of the feed until its matching variant image and
      // attributes are available. Never substitute another color's photo.
      if (!detail.image || (apparel && (!detail.color || !detail.size))) return [];
      const title = product.title + (variant.title === "Default Title" ? "" : ` — ${variant.title}`);
      return [`<item>${[
        tag("id", `${product.id}-${variant.id}`),
        tag("title", title.slice(0, 150)),
        tag("description", product.description.slice(0, 5000)),
        tag("link", productUrl(product.handle, variant.id)),
        tag("image_link", new URL(detail.image, SITE_URL).href),
        tag("availability", product.available && variant.available ? "in_stock" : "out_of_stock"),
        tag("price", `${variant.price.toFixed(2)} USD`),
        tag("condition", "new"), tag("brand", "Vineyard Sun"),
        tag("google_product_category", category),
        tag("product_type", product.category || product.type),
        product.variants.length > 1 ? tag("item_group_id", product.id) : "",
        detail.color ? tag("color", detail.color) : "",
        detail.size ? tag("size", detail.size) : "",
        apparel ? tag("gender", "unisex") + tag("age_group", /toddler/i.test(product.title) ? "toddler" : "adult") : "",
        `<g:shipping>${tag("country", "US")}${tag("service", "Standard shipping")}${tag("price", `${(shipping / 100).toFixed(2)} USD`)}</g:shipping>`,
      ].join("")}</item>`];
    }));
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Vineyard Sun products</title><link>${SITE_URL}</link><description>Current Vineyard Sun catalog, prices and availability</description>${items.join("")}</channel></rss>`, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    // A failed fetch must not look like an empty catalog and delete valid offers.
    return new Response("Product data is temporarily unavailable.", { status: 503, headers: { "Retry-After": "300" } });
  }
}
