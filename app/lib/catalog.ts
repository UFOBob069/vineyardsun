import catalogData from "../data/catalog.json";
import merchandisingData from "../data/merchandising.json";

export type CatalogVariant = {
  id: number;
  title: string;
  price: number;
  sourcePrice?: number;
  compareAtPrice: number | null;
  available: boolean;
  sku: string | null;
  printfulVariantId?: string;
  printfulVariantReference?: "external" | "sync";
};

export type CatalogProduct = {
  id: number;
  title: string;
  handle: string;
  type: string;
  fulfillment: "local" | "printful";
  description: string;
  image: string | null;
  images?: string[];
  available: boolean;
  variants: CatalogVariant[];
  source?: "legacy" | "printful-api";
  sourceTitle?: string;
  titleOverride?: string | null;
  category?: string;
  priceOverrides?: Record<string, number>;
  printfulStoreId?: string;
  printfulProductId?: string;
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

export function findCatalogVariant(
  productId: number,
  variantId: number,
  products: CatalogProduct[] = catalog,
  handle?: string,
) {
  const product = products.find(
    (item) => item.id === productId && (!handle || item.handle === handle),
  );
  const variant = product?.variants.find((item) => item.id === variantId);
  return product && variant ? { product, variant } : null;
}

export function cents(price: number) {
  return Math.round(price * 100);
}
