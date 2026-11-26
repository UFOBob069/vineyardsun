"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { CatalogProduct, CatalogVariant } from "../lib/catalog";
import { addCartLine, CART_STORAGE_KEY, parseCart, removePurchasedLines, type CartLine } from "../lib/cart";
import { analyticsSession, track } from "../lib/analytics";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type CartContextValue = { count: number; ready: boolean; pending: boolean; error: string; openBag: () => void; add: (product: CatalogProduct, variant: CatalogVariant, quantity?: number) => void; checkout: (lines: CartLine[], source: "bag" | "direct") => Promise<void>; complete: (sessionId: string, purchased: CartLine[]) => void };
const Context = createContext<CartContextValue | null>(null);
export function useCart() { const cart = useContext(Context); if (!cart) throw new Error("Missing cart provider"); return cart; }
export function BagButton() { const { count, openBag } = useCart(); return <button className="bag-button" type="button" onClick={openBag} aria-label={`Open shopping bag with ${count} items`}>Bag <span>{count}</span></button>; }

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]), [ready, setReady] = useState(false), [open, setOpen] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>([]), [shippingCents, setShipping] = useState(0);
  const [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), dialog = useRef<HTMLElement>(null), pathname = usePathname(), lastView = useRef("");
  useEffect(() => {
    // Device-local state is restored after hydration to keep server markup deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]"); setCart(parseCart(stored)); } catch { /* Start with an empty bag if storage is unavailable. */ }
    setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === CART_STORAGE_KEY) { try { setCart(parseCart(JSON.parse(event.newValue || "[]"))); } catch { /* Ignore malformed storage. */ } } };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { /* The bag still works in this tab. */ } } }, [cart, ready]);
  useEffect(() => {
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/order") && lastView.current !== pathname) { lastView.current = pathname; track("page_view"); }
  }, [pathname]);
  async function refresh() {
    setLoaded(false); setLoadError("");
    try {
      const response = await fetch("/api/storefront", { cache: "no-store" });
      if (!response.ok) throw new Error("We couldn't refresh your bag. Please try again.");
      const data = await response.json(); setProducts(data.products); setShipping(data.shippingCents); setLoaded(true);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Please try again."); }
  }
  function openBag() { setOpen(true); setError(""); void refresh(); }
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; dialog.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keys); return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keys); previous?.focus(); };
  }, [open]);
  function add(product: CatalogProduct, variant: CatalogVariant, quantity = 1) {
    if (!ready || !product.available || !variant.available) return;
    setCart(current => addCartLine(current, { productId: product.id, productHandle: product.handle, variantId: variant.id, quantity }));
    track("add_to_bag", { productHandle: product.handle, variantId: variant.id }); openBag();
  }
  async function checkout(lines: CartLine[], source: "bag" | "direct") {
    if (!ready || lock.current || !lines.length) return;
    lock.current = true; setPending(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, analyticsSessionId: analyticsSession() }) });
      const result = await response.json();
      if (!response.ok || !result.url || !result.sessionId) throw new Error(result.error || "Checkout could not start. Please try again.");
      try { sessionStorage.setItem(`vs-checkout:${result.sessionId}`, JSON.stringify({ source, lines })); } catch { /* Preserve the bag if a receipt cannot be matched later. */ }
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Checkout could not start. Please try again."); setPending(false); lock.current = false; }
  }
  function complete(sessionId: string, purchased: CartLine[]) {
    if (!ready) return;
    try {
      const key = `vs-checkout:${sessionId}`, marker = JSON.parse(sessionStorage.getItem(key) || "null");
      if (!marker) return;
      if (marker.source === "bag") setCart(current => removePurchasedLines(current, purchased));
      sessionStorage.removeItem(key);
    } catch { /* Never clear unrelated items on an unverified return. */ }
  }
  const lines = cart.map(line => {
    const product = products.find(p => p.id === line.productId && (!line.productHandle || p.handle === line.productHandle));
    const variant = product?.variants.find(v => v.id === line.variantId);
    return { line, product, variant };
  });
  const invalid = lines.some(({ product, variant }) => !product?.available || !variant?.available);
  const subtotal = lines.reduce((total, { line, variant }) => total + Math.round((variant?.price ?? 0) * 100) * line.quantity, 0);
  const update = (index: number, quantity: number) => setCart(current => current.flatMap((line, i) => i !== index ? [line] : quantity > 0 ? [{ ...line, quantity: Math.min(quantity, 10) }] : []));
  return <Context.Provider value={{ count: cart.reduce((sum, line) => sum + line.quantity, 0), ready, pending, error, openBag, add, checkout, complete }}>
    {children}
    {open && <div className="drawer-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <aside className="cart-drawer" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cart-title" tabIndex={-1}>
        <div className="drawer-heading"><div><p className="eyebrow">Your selection</p><h2 id="cart-title">Shopping bag</h2></div><button className="close-button" onClick={() => setOpen(false)} aria-label="Close cart">×</button></div>
        {!cart.length ? <div className="empty-cart"><p>Your bag is enjoying the shade.</p><Link className="button button-dark" href="/#catalog" onClick={() => setOpen(false)}>Browse the collection</Link></div> : !loaded ? <div className="empty-cart"><p role="status">{loadError || "Refreshing your bag…"}</p>{loadError && <button className="button button-dark" onClick={refresh}>Try again</button>}</div> : <>
          <div className="cart-lines">{lines.map(({ line, product, variant }, index) => <article className="cart-line" key={`${line.productId}:${line.variantId}`}>
            <div className="cart-line-image">{(variant?.image || product?.image) && <img src={variant?.image || product?.image || ""} alt="" />}</div>
            <div className="cart-line-copy"><h3>{product ? <a href={`/products/${product.handle}?variant=${variant?.id ?? line.variantId}`}>{product.title}</a> : "Unavailable item"}</h3>{variant?.title !== "Default Title" && <p>{variant?.title}</p>}<span>{variant ? money(Math.round(variant.price * 100)) : ""}</span>
              {(!product?.available || !variant?.available) && <p role="status">No longer available. Please remove this item.</p>}
              <div className="quantity-control" aria-label="Quantity controls"><button disabled={pending} onClick={() => update(index, line.quantity - 1)} aria-label={`Decrease ${product?.title ?? "item"} quantity`}>−</button><span>{line.quantity}</span><button disabled={pending || line.quantity >= 10} onClick={() => update(index, line.quantity + 1)} aria-label={`Increase ${product?.title ?? "item"} quantity`}>+</button></div>
              <button className="cart-remove" disabled={pending} onClick={() => update(index, 0)}>Remove<span className="sr-only"> {product?.title}</span></button>
            </div>
          </article>)}</div>
          <div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>US standard shipping</span><span>{money(shippingCents)}</span></div><div><span>Total before tax</span><strong>{money(subtotal + shippingCents)}</strong></div>
            <p>Estimated delivery: 4–12 business days. Made-to-order items may ship separately. <Link href="/shipping-returns" onClick={() => setOpen(false)}>Shipping &amp; 30-day returns</Link></p>
            <button className="button button-dark button-wide" disabled={!ready || pending || invalid} onClick={() => checkout(lines.map(({ line, product }) => ({ ...line, productHandle: product?.handle ?? line.productHandle })), "bag")}>{pending ? "Opening checkout…" : "Continue to checkout"}</button>
            {error && <p className="checkout-error" role="alert">{error}</p>}<span className="checkout-note">Secure checkout · Cards · Apple Pay · Google Pay</span>
          </div>
        </>}
      </aside>
    </div>}
  </Context.Provider>;
}
