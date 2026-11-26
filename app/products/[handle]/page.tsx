import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCatalog, productUrl, SITE_URL } from "../../lib/public-catalog";
import { ProductDetails } from "./ProductDetails";
import { ShopHeader } from "../../components/ShopHeader";
import { configuredShippingCents } from "../../lib/shipping";
import { googleDetails } from "../../lib/google-products";
import styles from "./product.module.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ variant?: string }> };

async function selection({ params, searchParams }: Props) {
  const [{ handle }, query, products] = await Promise.all([params, searchParams, getPublicCatalog()]);
  const product = products.find((p) => p.handle === handle);
  if (!product || !product.variants.length) notFound();
  const variant = query.variant
    ? product.variants.find((v) => String(v.id) === query.variant)
    : product.variants.find((v) => v.available) ?? product.variants[0];
  if (!variant) notFound();
  return { product, variant, hasVariant: Boolean(query.variant) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { product, variant, hasVariant } = await selection(props);
  const title = `${product.title} | Vineyard Sun`;
  const description = product.description.replace(/\s+/g, " ").slice(0, 160);
  const url = productUrl(product.handle, hasVariant ? variant.id : undefined);
  const image = googleDetails(product, variant).image;
  return { title, description, alternates: { canonical: url },
    openGraph: { title, description, url, images: image ? [new URL(image, SITE_URL).href] : [] },
    twitter: { card: "summary_large_image", title, description, images: image ? [new URL(image, SITE_URL).href] : [] },
  };
}

export default async function ProductPage(props: Props) {
  const { product, variant } = await selection(props);
  const detailedProduct = { ...product, variants: product.variants.map(v => ({ ...v, ...googleDetails(product, v) })) };
  return <div className="site-shell">
    <ShopHeader />
    <main className={styles.main}>
      <nav aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/#catalog">Shop</Link> / {product.title}</nav>
      <ProductDetails key={`${product.handle}:${variant.id}`} product={detailedProduct} initialVariantId={variant.id} shippingCents={configuredShippingCents()} />
    </main>
    <footer className={styles.footer}><Link href="/#catalog">Continue shopping</Link><Link href="/shipping-returns">Shipping &amp; returns</Link><Link href="/privacy">Privacy</Link><a href="mailto:info@vineyardsun.com">Contact Vineyard Sun</a></footer>
  </div>;
}
