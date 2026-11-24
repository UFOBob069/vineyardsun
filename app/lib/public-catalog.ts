import { cache } from "react";
import { catalog } from "./catalog";
import merchandising from "../data/merchandising.json";
import { getMerchandisingSettings } from "../../db/merchandising";
import { getSyncedCatalogProducts } from "../../db/synced-products";

export const SITE_URL = "https://www.vineyardsun.com";
export const productUrl = (handle: string, variantId?: number) =>
  `${SITE_URL}/products/${encodeURIComponent(handle)}${variantId ? `?variant=${variantId}` : ""}`;

// Use the same visibility, prices and image overrides as the storefront.
// Do not silently publish a stale catalog if the product database is unavailable.
export const getPublicCatalog = cache(async () => {
  const [settings, synced] = await Promise.all([
    getMerchandisingSettings({ strict: true }), getSyncedCatalogProducts(),
  ]);
  const hidden = new Set([...merchandising.hiddenProductHandles, ...settings.hiddenProductHandles]);
  const allowed = new Set<string>(merchandising.catalogProductHandles);
  return [...catalog, ...synced]
    .filter((p) => !hidden.has(p.handle) && (!allowed.size || allowed.has(p.handle)))
    .map((p) => {
      const override = settings.productImageSettings[p.handle];
      const images = [...new Set([override?.defaultUrl, p.image, ...(p.images ?? []), ...(override?.urls ?? [])]
        .filter((image): image is string => Boolean(image)))];
      return { ...p, image: images[0] ?? null, images };
    });
});
