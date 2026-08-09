"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import catalogData from "./data/catalog.json";
import merchandisingData from "./data/merchandising.json";

type Variant = {
  id: number;
  title: string;
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  sku: string | null;
};

type Product = {
  id: number;
  title: string;
  handle: string;
  type: string;
  fulfillment: "local" | "printful";
  description: string;
  image: string | null;
  available: boolean;
  variants: Variant[];
};

type CartLine = {
  variantId: number;
  productId: number;
  quantity: number;
};

type Filter = "all" | "eyewear" | "apparel" | "home";

type MerchandisingConfig = {
  featuredProductHandle: string;
  catalogProductHandles: string[];
  hiddenProductHandles: string[];
  priorityProductHandles: string[];
};

const allProducts = catalogData as Product[];
const merchandising = merchandisingData as MerchandisingConfig;

const partners = [
  {
    name: "Northstar Winery",
    location: "Walla Walla, Washington",
    image: "/brand/partner-northstar.png",
    href: "https://www.northstarwinery.com/",
  },
  {
    name: "Mercer Wine Estates",
    location: "Washington State",
    image: "/brand/partner-mercer.jpg",
    href: "https://mercerwine.com/",
  },
  {
    name: "Eternal Wine",
    location: "Walla Walla Valley",
    image: "/brand/partner-eternal.jpg",
    href: "https://eternalwine.com/",
  },
  {
    name: "BND Wines",
    location: "Oakville, Ontario",
    image: "/brand/partner-bnd.jpg",
    href: "https://www.bndwines.com/",
  },
  {
    name: "Wine LA",
    location: "Los Angeles, California",
    image: "/brand/partner-winela.png",
    href: "https://learnaboutwine.com/",
  },
  {
    name: "Helotes Creek Winery",
    location: "Helotes, Texas",
    image: "/brand/partner-helotes.jpg",
    href: null,
  },
] as const;
const SHOPIFY_DOMAIN = "vineyardsun.myshopify.com";
const CART_STORAGE_KEY = "vineyard-sun-cart-v1";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function categoryFor(product: Product): Exclude<Filter, "all"> {
  const haystack = `${product.type} ${product.title}`.toLowerCase();
  if (haystack.includes("sunglass")) return "eyewear";
  if (haystack.includes("pillow") || haystack.includes("home decor")) {
    return "home";
  }
  return "apparel";
}

function startingPrice(product: Product) {
  return Math.min(...product.variants.map((variant) => variant.price));
}

function fulfillmentCopy(product: Product) {
  return product.fulfillment === "printful"
    ? "Made to order by Printful"
    : "Ships from our studio";
}

export function Storefront({
  initialHiddenHandles,
}: {
  initialHiddenHandles: string[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const products = useMemo(() => {
    const allowedHandles = new Set(merchandising.catalogProductHandles);
    const hiddenHandles = new Set([
      ...merchandising.hiddenProductHandles,
      ...initialHiddenHandles,
    ]);
    const priorityByHandle = new Map(
      merchandising.priorityProductHandles.map((handle, index) => [handle, index]),
    );

    return allProducts
      .filter(
        (product) =>
          !hiddenHandles.has(product.handle) &&
          (allowedHandles.size === 0 || allowedHandles.has(product.handle)),
      )
      .sort((first, second) => {
        const firstPriority =
          priorityByHandle.get(first.handle) ?? Number.MAX_SAFE_INTEGER;
        const secondPriority =
          priorityByHandle.get(second.handle) ?? Number.MAX_SAFE_INTEGER;
        return firstPriority - secondPriority;
      });
  }, [initialHiddenHandles]);
  const featuredProduct =
    products.find(
      (product) => product.handle === merchandising.featuredProductHandle,
    );
  const syrahProduct = products.find(
    (product) => product.handle === "syrah-cork-sunglasses",
  );
  const cabernetProduct = products.find(
    (product) => product.handle === "cabernet-sauvignon-cork-sunglasses",
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      // Restoring device-local cart state after hydration avoids an SSR mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setCart(JSON.parse(stored) as CartLine[]);
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (cartReady) {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart, cartReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedProduct(null);
        setCartOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = filter === "all" || categoryFor(product) === filter;
      const searchMatch =
        !normalizedQuery ||
        `${product.title} ${product.type} ${product.description}`
          .toLowerCase()
          .includes(normalizedQuery);
      return categoryMatch && searchMatch;
    });
  }, [filter, products, query]);

  const cartDetails = cart
    .map((line) => {
      const product = allProducts.find((item) => item.id === line.productId);
      const variant = product?.variants.find(
        (item) => item.id === line.variantId,
      );
      return product && variant ? { ...line, product, variant } : null;
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  const cartQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartDetails.reduce(
    (sum, line) => sum + line.variant.price * line.quantity,
    0,
  );

  const addToCart = (product: Product, variant: Variant) => {
    setCart((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      if (existing) {
        return current.map((line) =>
          line.variantId === variant.id
            ? { ...line, quantity: Math.min(line.quantity + 1, 10) }
            : line,
        );
      }
      return [
        ...current,
        { productId: product.id, variantId: variant.id, quantity: 1 },
      ];
    });
    setSelectedProduct(null);
    setCartOpen(true);
  };

  const updateQuantity = (variantId: number, quantity: number) => {
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.variantId !== variantId)
        : current.map((line) =>
            line.variantId === variantId
              ? { ...line, quantity: Math.min(quantity, 10) }
              : line,
          ),
    );
  };

  const checkoutUrl = cartDetails.length
    ? `https://${SHOPIFY_DOMAIN}/cart/${cartDetails
        .map((line) => `${line.variant.id}:${line.quantity}`)
        .join(",")}?ref=vineyard-sun-rebuild`
    : "#";

  const focusCatalog = () => {
    document.querySelector("#catalog")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => searchRef.current?.focus(), 450);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Vineyard Sun home">
          VINEYARD <span>SUN</span>
        </a>

        <nav className={menuOpen ? "main-nav is-open" : "main-nav"}>
          <a href="#catalog" onClick={closeMenu}>Shop</a>
          <a href="#about" onClick={closeMenu}>About</a>
          <a href="#partners" onClick={closeMenu}>Partners</a>
          <a href="#reviews" onClick={closeMenu}>Reviews</a>
        </nav>

        <div className="header-actions">
          <button
            className="text-action search-action"
            type="button"
            onClick={focusCatalog}
          >
            Search
          </button>
          <button
            className="bag-button"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open shopping bag with ${cartQuantity} items`}
          >
            Bag <span>{cartQuantity}</span>
          </button>
          <button
            className="menu-button"
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-content">
            <p className="eyebrow light">Made for the golden hour</p>
            <h1 id="hero-title">The wine lover&apos;s eyewear.</h1>
            <p className="hero-copy">
              Cork-framed originals, sunny-day essentials, and a side collection
              for people who appreciate a good story.
            </p>
            <a className="button button-light" href="#catalog">
              Shop the collection
            </a>
          </div>
          <div className="hero-caption">Vineyard Sun · California</div>
        </section>

        <section className="service-strip" aria-label="Store benefits">
          <p><span>01</span> Independent since 2017</p>
          <p><span>02</span> Small-batch favorites</p>
          <p><span>03</span> Wine-country originals</p>
        </section>

        {featuredProduct && (
          <section className="pillow-feature" aria-labelledby="pillow-title">
            <div className="pillow-content">
              <p className="eyebrow light">Bestseller · embroidered</p>
              <h2 id="pillow-title">Happiness is positive cash flow.</h2>
              <p className="pillow-copy">
                Our signature navy pillow brings a little optimism to the office,
                study, or trading desk—with the reminder stitched right in.
              </p>
              <div className="pillow-price">
                <strong>{money(startingPrice(featuredProduct))}</strong>
                {featuredProduct.variants[0]?.compareAtPrice && (
                  <span>{money(featuredProduct.variants[0].compareAtPrice)}</span>
                )}
              </div>
              <div className="pillow-actions">
                <button
                  className="button button-light"
                  type="button"
                  onClick={() => {
                    const variant = featuredProduct.variants.find(
                      (item) => item.available,
                    );
                    if (variant) addToCart(featuredProduct, variant);
                  }}
                >
                  Add bestseller to bag
                </button>
                <button
                  className="button button-outline-light"
                  type="button"
                  onClick={() => setSelectedProduct(featuredProduct)}
                >
                  Product details
                </button>
              </div>
            </div>
            <button
              className="pillow-product"
              type="button"
              onClick={() => setSelectedProduct(featuredProduct)}
              aria-label={`View ${featuredProduct.title}`}
            >
              <span className="pillow-product-badge">No. 1 bestseller</span>
              <img
                src="/brand/cash-flow-pillow.jpg"
                alt="Navy Happiness is Positive Cash Flow embroidered pillow"
              />
            </button>
          </section>
        )}

        <section className="intro-section" id="story">
          <p className="eyebrow">The originals</p>
          <h2>Cork, character, and a little wine-country sun.</h2>
          <p>
            Vineyard Sun began with an idea: sunglasses can be useful, handsome,
            and still start a conversation. Each cork style takes its name and
            personality from a favorite varietal.
          </p>
        </section>

        {(syrahProduct || cabernetProduct) && (
        <section className="feature-pair">
          {syrahProduct && <article className="feature-card feature-syrah">
            <div className="feature-image">
              <img src="/brand/syrah.jpg" alt="Syrah cork sunglasses" />
              <span>01 / 02</span>
            </div>
            <div className="feature-copy">
              <p className="eyebrow">Rich & distinctive</p>
              <h2>Syrah</h2>
              <p>
                Clubmaster styling with a one-of-a-kind cork exterior. Built for
                wine lovers who would rather be outside.
              </p>
              <button
                className="text-link"
                type="button"
                onClick={() => setSelectedProduct(syrahProduct)}
              >
                View Syrah <span>→</span>
              </button>
            </div>
          </article>}

          {cabernetProduct && <article className="feature-card feature-cabernet">
            <div className="feature-copy">
              <p className="eyebrow">Bold & unforgettable</p>
              <h2>Cabernet Sauvignon</h2>
              <p>
                Violet mirrored lenses and warm cork details make this full-bodied
                frame impossible to miss.
              </p>
              <button
                className="text-link"
                type="button"
                onClick={() => setSelectedProduct(cabernetProduct)}
              >
                View Cabernet <span>→</span>
              </button>
            </div>
            <div className="feature-image">
              <img src="/brand/cabernet.jpg" alt="Cabernet Sauvignon cork sunglasses" />
              <span>02 / 02</span>
            </div>
          </article>}
        </section>
        )}

        <section className="catalog-section" id="catalog">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">The full edit</p>
              <h2>Shop Vineyard Sun</h2>
            </div>
            <p>
              Small-batch goods ship from our studio. Printed pieces are made to
              order by Printful, reducing unnecessary stock.
            </p>
          </div>

          <div className="catalog-tools">
            <div className="filter-list" aria-label="Filter products">
              {(["all", "eyewear", "apparel", "home"] as Filter[]).map(
                (item) => (
                  <button
                    key={item}
                    className={filter === item ? "active" : ""}
                    type="button"
                    onClick={() => setFilter(item)}
                  >
                    {item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}
                  </button>
                ),
              )}
            </div>
            <label className="catalog-search">
              <span className="sr-only">Search products</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the collection"
              />
            </label>
          </div>

          <p className="result-count" aria-live="polite">
            {visibleProducts.length} {visibleProducts.length === 1 ? "piece" : "pieces"}
          </p>

          <div className="product-grid">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onOpen={() => setSelectedProduct(product)}
                onAdd={addToCart}
              />
            ))}
          </div>

          {visibleProducts.length === 0 && (
            <div className="empty-catalog">
              <h3>No matches yet.</h3>
              <p>Try a different search or return to the full collection.</p>
              <button
                className="button button-dark"
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Show everything
              </button>
            </div>
          )}
        </section>

        <section className="partners-section" id="partners">
          <div className="partners-heading">
            <div>
              <p className="eyebrow">Stockists & collaborators</p>
              <h2>Shared around the table.</h2>
            </div>
            <p>
              Vineyard Sun has traveled through tasting rooms, wine communities,
              and collaborations from Texas and Washington to Ontario and France.
            </p>
          </div>

          <div className="partner-grid">
            {partners.map((partner) => {
              const content = (
                <>
                  <div className="partner-logo">
                    <img src={partner.image} alt={`${partner.name} logo`} />
                  </div>
                  <div className="partner-meta">
                    <h3>{partner.name}</h3>
                    <p>
                      {partner.location}
                      {partner.href && <span>↗</span>}
                    </p>
                  </div>
                </>
              );

              return partner.href ? (
                <a
                  className="partner-card"
                  href={partner.href}
                  target="_blank"
                  rel="noreferrer"
                  key={partner.name}
                >
                  {content}
                </a>
              ) : (
                <article className="partner-card" key={partner.name}>
                  {content}
                </article>
              );
            })}
          </div>

          <article className="partner-story">
            <img
              src="/brand/partner-sommeliers.jpg"
              alt="Alaric de Portal, Christian Martray, and Oliver Poussier wearing Vineyard Sun sunglasses"
            />
            <div>
              <p className="eyebrow light">Vineyard Sun in France</p>
              <h3>A well-traveled pair of shades.</h3>
              <p>
                Alaric de Portal, sommelier Christian Martray, and Oliver Poussier,
                World&apos;s Best Sommelier 2000, sporting Vineyard Sun in France.
              </p>
            </div>
          </article>
        </section>

        <section className="reviews-section" id="reviews">
          <div className="reviews-heading">
            <div>
              <p className="eyebrow">What reviewers noticed</p>
              <h2>Lightweight. Durable. Hard to ignore.</h2>
            </div>
            <p>
              Published feedback from people who wore Vineyard Sun beyond the
              tasting room.
            </p>
          </div>

          <div className="testimonial-grid">
            <figure className="testimonial-card">
              <span className="testimonial-number">01 / Construction</span>
              <blockquote>
                “Well constructed, functional, certainly a conversation-starter,
                and seems more durable than you might first think.”
              </blockquote>
              <figcaption>
                <span>1WineDude.com</span>
                <a
                  href="https://www.1winedude.com/the-shady-the-free-and-the-godforsaken-may-2018-wine-product-roundup/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read review ↗
                </a>
              </figcaption>
            </figure>

            <figure className="testimonial-card">
              <span className="testimonial-number">02 / Everyday wear</span>
              <blockquote>
                “I have worn these non-stop since they arrived.”
              </blockquote>
              <figcaption>
                <span>Texas Wine Lover</span>
                <a
                  href="https://txwinelover.com/2019/01/vineyard-sun-sunglasses-the-wine-lovers-eyewear/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read review ↗
                </a>
              </figcaption>
            </figure>

            <figure className="testimonial-card">
              <span className="testimonial-number">03 / Lightweight feel</span>
              <blockquote>
                “The frame material is extraordinarily lightweight.”
              </blockquote>
              <figcaption>
                <span>Texas Wine Lover</span>
              <a
                href="https://txwinelover.com/2019/01/vineyard-sun-sunglasses-the-wine-lovers-eyewear/"
                target="_blank"
                rel="noreferrer"
              >
                  Read review ↗
              </a>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-image">
            <img
              src="/brand/founder.png"
              alt="Vineyard Sun founder Joseph O'Bell in Napa Valley"
            />
            <span>Joseph O&apos;Bell · Founder</span>
          </div>
          <div className="about-copy">
            <p className="eyebrow">About Vineyard Sun</p>
            <h2>Born after a winery weekend near Austin.</h2>
            <p>
              Vineyard Sun is a lifestyle eyewear line for people who love wine
              and vineyards. Founder Joseph O&apos;Bell had the idea after a winery
              tour near Austin, Texas: cork sunglasses felt like the natural
              companion to the experience.
            </p>
            <p>
              After refining the designs, Vineyard Sun launched in spring 2017
              with two original cork styles—Syrah and Cabernet Sauvignon—and a
              belief that useful things should still start conversations.
            </p>
            <a className="text-link" href="mailto:info@vineyardsun.com">
              Contact us <span>→</span>
            </a>
          </div>
        </section>

      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <a className="wordmark wordmark-light" href="#top">
            VINEYARD <span>SUN</span>
          </a>
          <p>Wine-country character for wherever the sun finds you.</p>
        </div>
        <div className="footer-links">
          <div>
            <h3>Explore</h3>
            <a href="#catalog">Catalog</a>
            <a href="#about">About us</a>
            <a href="#partners">Partners</a>
            <a href="#reviews">Reviews</a>
          </div>
          <div>
            <h3>Follow</h3>
            <a
              href="https://www.instagram.com/vineyard_sun/"
              target="_blank"
              rel="noreferrer"
            >
              Instagram ↗
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Vineyard Sun</span>
          <a href="mailto:info@vineyardsun.com">info@vineyardsun.com</a>
        </div>
      </footer>

      {selectedProduct && (
        <ProductDialog
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
        />
      )}

      {cartOpen && (
        <CartDrawer
          lines={cartDetails}
          total={cartTotal}
          checkoutUrl={checkoutUrl}
          onClose={() => setCartOpen(false)}
          onUpdate={updateQuantity}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  index,
  onOpen,
  onAdd,
}: {
  product: Product;
  index: number;
  onOpen: () => void;
  onAdd: (product: Product, variant: Variant) => void;
}) {
  const availableVariants = product.variants.filter((variant) => variant.available);
  const quickAddVariant =
    availableVariants.length === 1 ? availableVariants[0] : null;

  const handleQuickAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (quickAddVariant) onAdd(product, quickAddVariant);
    else onOpen();
  };

  return (
    <article
      className="product-card"
      style={{ "--card-delay": `${Math.min(index, 8) * 35}ms` } as React.CSSProperties}
    >
      <button className="product-visual" type="button" onClick={onOpen}>
        {product.image ? (
          <img src={product.image} alt={product.title} loading="lazy" />
        ) : (
          <span className="image-placeholder">Vineyard Sun</span>
        )}
        <span className={`fulfillment-tag ${product.fulfillment}`}>
          {product.fulfillment === "printful" ? "Made to order" : "Small batch"}
        </span>
        {!product.available && <span className="sold-tag">Sold out</span>}
      </button>
      <div className="product-info">
        <button className="product-title" type="button" onClick={onOpen}>
          {product.title}
        </button>
        <p>{fulfillmentCopy(product)}</p>
        <div className="product-bottom">
          <span>From {money(startingPrice(product))}</span>
          <button
            className="quick-add"
            type="button"
            disabled={!product.available}
            onClick={handleQuickAdd}
            aria-label={`Add ${product.title} to bag`}
          >
            {product.available ? "+" : "—"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductDialog({
  product,
  onClose,
  onAdd,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product, variant: Variant) => void;
}) {
  const firstAvailable =
    product.variants.find((variant) => variant.available) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable.id);
  const selectedVariant =
    product.variants.find((variant) => variant.id === variantId) ?? firstAvailable;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="product-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
      >
        <button className="close-button" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="dialog-image">
          {product.image && <img src={product.image} alt={product.title} />}
        </div>
        <div className="dialog-copy">
          <p className="eyebrow">{fulfillmentCopy(product)}</p>
          <h2 id="product-dialog-title">{product.title}</h2>
          <p className="dialog-price">{money(selectedVariant.price)}</p>
          {product.variants.length > 1 && (
            <label className="variant-field">
              <span>Choose an option</span>
              <select
                value={variantId}
                onChange={(event) => setVariantId(Number(event.target.value))}
              >
                {product.variants.map((variant) => (
                  <option
                    key={variant.id}
                    value={variant.id}
                    disabled={!variant.available}
                  >
                    {variant.title} · {money(variant.price)}
                    {!variant.available ? " · Sold out" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="button button-dark button-wide"
            type="button"
            disabled={!selectedVariant.available}
            onClick={() => onAdd(product, selectedVariant)}
          >
            {selectedVariant.available ? "Add to bag" : "Sold out"}
          </button>
          <div className="dialog-description">
            {product.description
              .split("\n")
              .slice(0, 5)
              .map((paragraph, index) => (
                <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function CartDrawer({
  lines,
  total,
  checkoutUrl,
  onClose,
  onUpdate,
}: {
  lines: Array<CartLine & { product: Product; variant: Variant }>;
  total: number;
  checkoutUrl: string;
  onClose: () => void;
  onUpdate: (variantId: number, quantity: number) => void;
}) {
  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <div className="drawer-heading">
          <div>
            <p className="eyebrow">Your selection</p>
            <h2 id="cart-title">Shopping bag</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close cart">
            ×
          </button>
        </div>

        {lines.length ? (
          <>
            <div className="cart-lines">
              {lines.map((line) => (
                <article className="cart-line" key={line.variant.id}>
                  <div className="cart-line-image">
                    {line.product.image && (
                      <img src={line.product.image} alt="" />
                    )}
                  </div>
                  <div className="cart-line-copy">
                    <h3>{line.product.title}</h3>
                    {line.variant.title !== "Default Title" && (
                      <p>{line.variant.title}</p>
                    )}
                    <span>{money(line.variant.price)}</span>
                    <div className="quantity-control" aria-label="Quantity controls">
                      <button
                        type="button"
                        onClick={() => onUpdate(line.variant.id, line.quantity - 1)}
                        aria-label={`Decrease ${line.product.title} quantity`}
                      >
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdate(line.variant.id, line.quantity + 1)}
                        aria-label={`Increase ${line.product.title} quantity`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="cart-summary">
              <div>
                <span>Subtotal</span>
                <strong>{money(total)}</strong>
              </div>
              <p>Shipping and taxes are calculated securely at checkout.</p>
              <a className="button button-dark button-wide" href={checkoutUrl}>
                Continue to secure checkout
              </a>
              <span className="checkout-note">Cards · Apple Pay · Google Pay · Shop Pay</span>
            </div>
          </>
        ) : (
          <div className="empty-cart">
            <p>Your bag is enjoying the shade.</p>
            <button className="button button-dark" type="button" onClick={onClose}>
              Browse the collection
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
