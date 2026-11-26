import type { MetadataRoute } from "next";
import { getPublicCatalog, productUrl, SITE_URL } from "./lib/public-catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getPublicCatalog();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/custom-vineyard-sunglasses`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/shipping-returns`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    ...products.map((p) => ({ url: productUrl(p.handle), changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
