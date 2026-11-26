"use client";
import { useEffect, useRef, useState } from "react";
import type { CatalogProduct } from "../../lib/catalog";
import { Purchase } from "./Purchase";
import { ShippingNote } from "../../components/ShippingNote";
import { track } from "../../lib/analytics";
import styles from "./product.module.css";
export function ProductDetails({ product, initialVariantId, shippingCents }: { product: CatalogProduct; initialVariantId: number; shippingCents: number }) {
  const [variantId, setVariantId] = useState(initialVariantId), [imageIndex, setImageIndex] = useState(0);
  const seen = useRef(false);
  const variant = product.variants.find(v => v.id === variantId) ?? product.variants[0];
  const images = [...new Set([variant.image, product.image, ...(product.images ?? [])].filter((src): src is string => Boolean(src)))];
  const image = images[imageIndex] ?? images[0];
  const eyewear = product.type.toLowerCase().includes("sunglass");
  useEffect(() => { if (!seen.current) { seen.current = true; track("product_view", { productHandle: product.handle, variantId: initialVariantId }); } }, [product.handle, initialVariantId]);
  const url = `https://www.vineyardsun.com/products/${product.handle}?variant=${variant.id}`;
  const schema = { "@context": "https://schema.org", "@type": "Product", name: product.title, description: product.description,
    image: images.map(src => new URL(src, "https://www.vineyardsun.com").href), sku: variant.sku ?? String(variant.id),
    ...(variant.color ? { color: variant.color } : {}), ...(variant.size ? { size: variant.size } : {}), brand: { "@type": "Brand", name: "Vineyard Sun" },
    offers: { "@type": "Offer", url, price: variant.price.toFixed(2), priceCurrency: "USD", itemCondition: "https://schema.org/NewCondition", availability: product.available && variant.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", seller: { "@type": "Organization", name: "Vineyard Sun" } } };
  function select(id: number) {
    setVariantId(id); setImageIndex(0);
    const next = new URL(window.location.href); next.searchParams.set("variant", String(id)); window.history.replaceState(null, "", next);
    track("variant_changed", { productHandle: product.handle, variantId: id });
  }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <div className={styles.product}>
      <div className={styles.images}>
        {image && <a href={image} target="_blank" rel="noreferrer" aria-label={`Open full-size photo of ${product.title}`}><img className={styles.mainImage} src={image} alt={product.title} /></a>}
        {images.length > 1 && <div className={styles.thumbnails} aria-label="Product photos">{images.map((src, index) => <button key={src} aria-label={`View photo ${index + 1}`} aria-pressed={image === src} onClick={() => setImageIndex(index)}><img src={src} alt="" loading="lazy" /></button>)}</div>}
        <p className={styles.photoHint}>Select a photo to see it full size.</p>
      </div>
      <section className={styles.details}>
        <p className="eyebrow">{product.fulfillment === "printful" ? "Made to order" : "Ships from our studio"}</p>
        <h1>{product.title}</h1>
        <p className={styles.price} aria-live="polite">${variant.price.toFixed(2)} <small>USD</small>{variant.compareAtPrice && variant.compareAtPrice > variant.price && <del className={styles.previousPrice}>${variant.compareAtPrice.toFixed(2)}</del>}</p>
        <p aria-live="polite">{product.available && variant.available ? "In stock" : "Sold out"}{variant.title !== "Default Title" ? ` · ${variant.title}` : ""}</p>
        {product.variants.length > 1 && <div className={styles.options}><label htmlFor="variant">Choose an option</label><select id="variant" value={variantId} onChange={event => select(Number(event.target.value))}>{product.variants.map(v => <option key={v.id} value={v.id} disabled={!v.available}>{v.title} · ${v.price.toFixed(2)}{!v.available ? " · Sold out" : ""}</option>)}</select></div>}
        <Purchase product={product} variant={variant} />
        <ShippingNote shippingCents={shippingCents} madeToOrder={product.fulfillment === "printful"} />
        {eyewear && <figure className={styles.review}><blockquote>{product.handle.startsWith("syrah") ? "“Well constructed, functional, certainly a conversation-starter”" : "“I have worn these non-stop since they arrived.”"}</blockquote><figcaption><a href={product.handle.startsWith("syrah") ? "https://www.1winedude.com/the-shady-the-free-and-the-godforsaken-may-2018-wine-product-roundup/" : "https://txwinelover.com/2019/01/vineyard-sun-sunglasses-the-wine-lovers-eyewear/"} target="_blank" rel="noreferrer">{product.handle.startsWith("syrah") ? "1WineDude · Syrah review, 2018" : "Texas Wine Lover · Cabernet review, 2019"} ↗</a><small>Review sample provided.</small></figcaption></figure>}
        <div className={styles.description}><h2>The details</h2>{product.description.split("\n").filter(Boolean).map((text, index) => <p key={index}>{text}</p>)}</div>
        {eyewear && <div className={styles.help}><h2>Find your fit</h2><p>Need frame measurements, lens details, or advice on what&apos;s included? <a href={`mailto:info@vineyardsun.com?subject=${encodeURIComponent(`Question about ${product.title}`)}`}>Ask us before ordering.</a></p><a href="/custom-vineyard-sunglasses">Ordering for a winery? Discuss a custom project →</a></div>}
      </section>
    </div>
  </>;
}
