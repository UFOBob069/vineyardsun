import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCatalog, productUrl, SITE_URL } from "../../lib/public-catalog";
import { Purchase } from "./Purchase";
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
  const detail = googleDetails(product, variant);
  const images = detail.image ? [detail.image] : product.images;
  const schema = {
    "@context": "https://schema.org", "@type": "Product",
    name: product.title, description: product.description,
    image: images.map((image) => new URL(image, SITE_URL).href),
    ...(detail.color ? { color: detail.color } : {}),
    ...(detail.size ? { size: detail.size } : {}),
    sku: variant.sku ?? String(variant.id),
    brand: { "@type": "Brand", name: "Vineyard Sun" },
    offers: { "@type": "Offer", url: productUrl(product.handle, variant.id),
      price: variant.price.toFixed(2), priceCurrency: "USD",
      itemCondition: "https://schema.org/NewCondition",
      availability: product.available && variant.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Vineyard Sun" } },
  };
  return <div className="site-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <header className="site-header"><a className="wordmark" href="/">VINEYARD <span>SUN</span></a><a href="/#catalog">Shop the collection</a></header>
    <main className={styles.main}>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#catalog">Shop</a> / {product.title}</nav>
      <div className={styles.product}>
        <div className={styles.images}>{images.map((src, i) => <img key={src} src={src} alt={i ? `${product.title} — view ${i + 1}` : product.title} loading={i ? "lazy" : "eager"} />)}</div>
        <section className={styles.details}>
          <p className="eyebrow">{product.fulfillment === "printful" ? "Made to order by Printful" : "Ships from our studio"}</p>
          <h1>{product.title}</h1>
          <p className={styles.price}>${variant.price.toFixed(2)} <small>USD</small></p>
          <p>{product.available && variant.available ? "In stock" : "Sold out"}{variant.title !== "Default Title" ? ` · ${variant.title}` : ""}</p>
          {product.variants.length > 1 && <form method="get" className={styles.options}>
            <label htmlFor="variant">Choose an option</label>
            <select id="variant" name="variant" defaultValue={variant.id}>{product.variants.map((v) => <option key={v.id} value={v.id}>{v.title} · ${v.price.toFixed(2)}{!v.available ? " · Sold out" : ""}</option>)}</select>
            <button type="submit" className="button button-outline">Update selection</button>
          </form>}
          <Purchase product={product} variant={variant} />
          <p className={styles.note}>Shipping and applicable taxes are calculated at checkout. Ships within the United States.</p>
          <div className={styles.description}>{product.description.split("\n").filter(Boolean).map((text, i) => <p key={i}>{text}</p>)}</div>
        </section>
      </div>
    </main>
    <footer className={styles.footer}><a href="/#catalog">Continue shopping</a><a href="mailto:info@vineyardsun.com">Contact Vineyard Sun</a></footer>
  </div>;
}
