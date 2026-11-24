import details from "../data/google-product-details.json";
import type { CatalogProduct, CatalogVariant } from "./catalog";

type Details = { image: string; color: string | null; size: string | null };
const variantDetails = details as Record<string, Record<string, Details>>;

export function googleDetails(product: CatalogProduct, variant: CatalogVariant) {
  if (variant.image) return { image: variant.image, color: variant.color ?? null, size: variant.size ?? null };
  const detail = variantDetails[product.handle]?.[String(variant.id)];
  if (detail) return detail;
  if (product.type === "Sunglasses" && product.image) {
    return { image: product.image, color: "Brown", size: "One size" };
  }
  return { image: product.image, color: null, size: null };
}

export function googleCategory(product: CatalogProduct) {
  const type = `${product.type} ${product.title}`.toLowerCase();
  if (type.includes("sunglass")) return "Apparel & Accessories > Clothing Accessories > Sunglasses";
  if (type.includes("pillow")) return "Home & Garden > Decor > Throw Pillows";
  if (type.includes("hat") || type.includes("cap")) return "Apparel & Accessories > Clothing Accessories > Hats";
  return "Apparel & Accessories > Clothing > Shirts & Tops";
}

export function xml(value: string | number) {
  return String(value).replace(/[&<>\"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]!));
}
