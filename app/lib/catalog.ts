import catalogData from "../data/catalog.json";
import merchandisingData from "../data/merchandising.json";

export type CatalogVariant = {
  id: number;
  title: string;
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  sku: string | null;
};

export type CatalogProduct = {
  id: number;
  title: string;
  handle: string;
  type: string;
  fulfillment: "local" | "printful";
  description: string;
  image: string | null;
  available: boolean;
  variants: CatalogVariant[];
};

type MerchandisingConfig = {
  catalogProductHandles: string[];
  hiddenProductHandles: string[];
};

export const catalog = catalogData as CatalogProduct[];
const merchandising = merchandisingData as MerchandisingConfig;

export function productIsInStorefrontCatalog(handle: string) {
  const allowed = merchandising.catalogProductHandles;
  return (
    !merchandising.hiddenProductHandles.includes(handle) &&
    (allowed.length === 0 || allowed.includes(handle))
  );
}

export function findCatalogVariant(productId: number, variantId: number) {
  const product = catalog.find((item) => item.id === productId);
  const variant = product?.variants.find((item) => item.id === variantId);
  return product && variant ? { product, variant } : null;
}

export function cents(price: number) {
  return Math.round(price * 100);
}
