"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CatalogProduct } from "../lib/catalog";
import {
  MAX_CUSTOM_IMAGES_PER_PRODUCT,
  normalizeRemoteImageUrl,
  type ProductImageSetting,
  type ProductImageSettings,
} from "../lib/product-image-settings";
import styles from "./admin.module.css";

type Product = CatalogProduct;

type SyncedProductEdit = {
  handle: string;
  titleOverride: string | null;
  description: string;
  category: string;
  priceOverrides: Record<string, number>;
};

function cloneImageSettings(settings: ProductImageSettings): ProductImageSettings {
  return Object.fromEntries(
    Object.entries(settings).map(([handle, setting]) => [
      handle,
      { urls: [...setting.urls], defaultUrl: setting.defaultUrl },
    ]),
  );
}

function serializeImageSettings(settings: ProductImageSettings) {
  return JSON.stringify(
    Object.entries(settings)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([handle, setting]) => [handle, setting.urls, setting.defaultUrl]),
  );
}

function editsForProducts(products: Product[]) {
  return Object.fromEntries(
    products
      .filter((product) => product.source === "printful-api")
      .map((product) => [
        product.handle,
        {
          handle: product.handle,
          titleOverride: product.titleOverride ?? null,
          description: product.description,
          category: product.category ?? product.type ?? "Apparel",
          priceOverrides: { ...(product.priceOverrides ?? {}) },
        } satisfies SyncedProductEdit,
      ]),
  ) as Record<string, SyncedProductEdit>;
}

function serializeSyncedEdits(edits: Record<string, SyncedProductEdit>) {
  return JSON.stringify(
    Object.values(edits)
      .sort((first, second) => first.handle.localeCompare(second.handle))
      .map((edit) => ({
        ...edit,
        priceOverrides: Object.fromEntries(
          Object.entries(edit.priceOverrides).sort(([first], [second]) =>
            first.localeCompare(second),
          ),
        ),
      })),
  );
}

export function AdminClient() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [hiddenHandles, setHiddenHandles] = useState<Set<string>>(new Set());
  const [savedHandles, setSavedHandles] = useState<Set<string>>(new Set());
  const [productImageSettings, setProductImageSettings] = useState<ProductImageSettings>({});
  const [savedImageSettings, setSavedImageSettings] = useState<ProductImageSettings>({});
  const [syncedProductEdits, setSyncedProductEdits] = useState<
    Record<string, SyncedProductEdit>
  >({});
  const [savedSyncedProductEdits, setSavedSyncedProductEdits] = useState<
    Record<string, SyncedProductEdit>
  >({});
  const [expandedHandle, setExpandedHandle] = useState<string | null>(null);
  const [imageUrlDrafts, setImageUrlDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadCatalog = async () => {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load product settings.");
    const data = (await response.json()) as {
      products: Product[];
      hiddenProductHandles: string[];
      productImageSettings: ProductImageSettings;
    };
    const next = new Set(data.hiddenProductHandles);
    const nextImages = cloneImageSettings(data.productImageSettings ?? {});
    setHiddenHandles(next);
    setSavedHandles(new Set(next));
    setProductImageSettings(nextImages);
    setSavedImageSettings(cloneImageSettings(nextImages));
    setProducts(data.products);
    const edits = editsForProducts(data.products);
    setSyncedProductEdits(edits);
    setSavedSyncedProductEdits(editsForProducts(data.products));
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const data = (await response.json()) as {
          authenticated: boolean;
          configured: boolean;
        };
        setAuthenticated(data.authenticated);
        setConfigured(data.configured);
        if (data.authenticated) await loadCatalog();
      } catch {
        setError("The admin area could not be loaded. Please try again.");
      } finally {
        setCheckingSession(false);
      }
    };
    void checkSession();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      `${product.title} ${product.type}`.toLowerCase().includes(normalized),
    );
  }, [products, query]);

  const hasChanges =
    hiddenHandles.size !== savedHandles.size ||
    [...hiddenHandles].some((handle) => !savedHandles.has(handle)) ||
    serializeImageSettings(productImageSettings) !== serializeImageSettings(savedImageSettings) ||
    serializeSyncedEdits(syncedProductEdits) !==
      serializeSyncedEdits(savedSyncedProductEdits);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Sign in failed.");
      setAuthenticated(true);
      setPassword("");
      await loadCatalog();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setProducts([]);
    setHiddenHandles(new Set());
    setSavedHandles(new Set());
    setProductImageSettings({});
    setSavedImageSettings({});
    setSyncedProductEdits({});
    setSavedSyncedProductEdits({});
    setExpandedHandle(null);
  };

  const toggleProduct = (handle: string) => {
    setHiddenHandles((current) => {
      const next = new Set(current);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
    setError("");
  };

  const setProductImageSetting = (product: Product, setting: ProductImageSetting) => {
    setProductImageSettings((current) => {
      const next = { ...current };
      const sourceDefault = product.image ?? product.images?.[0] ?? null;
      const isCatalogDefault = !setting.defaultUrl || setting.defaultUrl === sourceDefault;
      if (!setting.urls.length && isCatalogDefault) delete next[product.handle];
      else next[product.handle] = setting;
      return next;
    });
    setError("");
  };

  const addImageUrl = (event: FormEvent<HTMLFormElement>, product: Product) => {
    event.preventDefault();
    const imageUrl = normalizeRemoteImageUrl(imageUrlDrafts[product.handle]);
    if (!imageUrl) {
      setError("Enter a direct HTTPS image URL.");
      return;
    }

    const current = productImageSettings[product.handle] ?? { urls: [], defaultUrl: null };
    if (
      current.urls.includes(imageUrl) ||
      product.image === imageUrl ||
      product.images?.includes(imageUrl)
    ) {
      setError("That image is already listed for this product.");
      return;
    }
    if (current.urls.length >= MAX_CUSTOM_IMAGES_PER_PRODUCT) {
      setError(`Each product can have up to ${MAX_CUSTOM_IMAGES_PER_PRODUCT} added images.`);
      return;
    }

    setProductImageSetting(product, {
      urls: [...current.urls, imageUrl],
      defaultUrl: current.defaultUrl ?? product.image ?? imageUrl,
    });
    setImageUrlDrafts((drafts) => ({ ...drafts, [product.handle]: "" }));
  };

  const removeImageUrl = (product: Product, imageUrl: string) => {
    const current = productImageSettings[product.handle] ?? { urls: [], defaultUrl: null };
    const urls = current.urls.filter((url) => url !== imageUrl);
    setProductImageSetting(product, {
      urls,
      defaultUrl:
        current.defaultUrl === imageUrl
          ? product.image ?? product.images?.[0] ?? urls[0] ?? null
          : current.defaultUrl,
    });
  };

  const chooseDefaultImage = (product: Product, imageUrl: string) => {
    const current = productImageSettings[product.handle] ?? { urls: [], defaultUrl: null };
    setProductImageSetting(product, { ...current, defaultUrl: imageUrl });
  };

  const updateSyncedProduct = (
    handle: string,
    update: (current: SyncedProductEdit) => SyncedProductEdit,
  ) => {
    setSyncedProductEdits((current) => {
      const edit = current[handle];
      return edit ? { ...current, [handle]: update(edit) } : current;
    });
    setError("");
    setNotice("");
  };

  const updatePriceOverride = (
    product: Product,
    variantId: number,
    value: string,
  ) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0.5) return;
    updateSyncedProduct(product.handle, (current) => ({
      ...current,
      priceOverrides: {
        ...current.priceOverrides,
        [String(variantId)]: Math.round(parsed * 100),
      },
    }));
  };

  const resetPriceOverride = (product: Product, variantId: number) => {
    updateSyncedProduct(product.handle, (current) => {
      const priceOverrides = { ...current.priceOverrides };
      delete priceOverrides[String(variantId)];
      return { ...current, priceOverrides };
    });
  };

  const syncPrintful = async () => {
    if (hasChanges) {
      setError("Save your current changes before syncing from Printful.");
      return;
    }
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/printful-sync", { method: "POST" });
      const data = (await response.json()) as {
        error?: string;
        imported?: number;
        added?: number;
        updated?: number;
        deactivated?: number;
      };
      if (!response.ok) {
        if (response.status === 401) setAuthenticated(false);
        throw new Error(data.error ?? "Printful sync failed.");
      }
      await loadCatalog();
      setNotice(
        `Synced ${data.imported ?? 0} product${data.imported === 1 ? "" : "s"} from David's Store · ${data.added ?? 0} new · ${data.updated ?? 0} updated. New products remain hidden until you publish them.`,
      );
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Printful sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hiddenProductHandles: [...hiddenHandles],
          productImageSettings,
          syncedProductEdits: Object.values(syncedProductEdits),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        hiddenProductHandles?: string[];
        productImageSettings?: ProductImageSettings;
      };
      if (!response.ok) {
        if (response.status === 401) setAuthenticated(false);
        throw new Error(data.error ?? "Could not save changes.");
      }
      const savedHandlesFromResponse = new Set(data.hiddenProductHandles ?? [...hiddenHandles]);
      const savedImages = cloneImageSettings(data.productImageSettings ?? productImageSettings);
      setHiddenHandles(savedHandlesFromResponse);
      setSavedHandles(new Set(savedHandlesFromResponse));
      setProductImageSettings(savedImages);
      setSavedImageSettings(cloneImageSettings(savedImages));
      setSavedSyncedProductEdits(
        Object.fromEntries(
          Object.entries(syncedProductEdits).map(([handle, edit]) => [
            handle,
            { ...edit, priceOverrides: { ...edit.priceOverrides } },
          ]),
        ),
      );
      setNotice("Product settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingSession) {
    return <main className={styles.loading}>Loading product controls…</main>;
  }

  if (!authenticated) {
    return (
      <main className={styles.loginPage}>
        <Link className={styles.wordmark} href="/">VINEYARD <span>SUN</span></Link>
        <form className={styles.loginCard} onSubmit={login}>
          <p className={styles.eyebrow}>Store administration</p>
          <h1>Product visibility</h1>
          <p>Sign in to choose which products appear in the storefront.</p>
          <label>
            <span>Admin password</span>
            <input
              autoComplete="current-password"
              disabled={!configured}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {!configured && (
            <div className={styles.notice}>
              Set the <code>ADMIN_PASSWORD</code> environment variable, then
              redeploy the site.
            </div>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button disabled={!configured || saving} type="submit">
            {saving ? "Signing in…" : "Sign in"}
          </button>
          <Link className={styles.backLink} href="/">← Return to storefront</Link>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div>
          <Link className={styles.wordmark} href="/">VINEYARD <span>SUN</span></Link>
          <p>Product visibility</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" target="_blank" rel="noreferrer">View store ↗</Link>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className={styles.workspace}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Storefront catalog</p>
            <h1>Choose what customers see.</h1>
            <p>
              {products.filter((product) => !hiddenHandles.has(product.handle)).length} visible ·{" "}
              {products.filter((product) => hiddenHandles.has(product.handle)).length} hidden
            </p>
          </div>
          <div className={styles.headingActions}>
            <button
              className={styles.syncButton}
              disabled={syncing || saving}
              onClick={syncPrintful}
              type="button"
            >
              {syncing ? "Syncing…" : "Sync David's Store"}
            </button>
            <button
              className={styles.saveButton}
              disabled={!hasChanges || saving || syncing}
              onClick={save}
              type="button"
            >
              {saving ? "Saving…" : hasChanges ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <label>
            <span className={styles.srOnly}>Search products</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              type="search"
              value={query}
            />
          </label>
          <div>
            <button type="button" onClick={() => setHiddenHandles(new Set())}>Show all</button>
            <button
              type="button"
              onClick={() => setHiddenHandles(new Set(products.map((product) => product.handle)))}
            >
              Hide all
            </button>
          </div>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.success} role="status">{notice}</p>}

        <div className={styles.productList}>
          {filteredProducts.map((product: Product) => {
            const visible = !hiddenHandles.has(product.handle);
            const imageSetting = productImageSettings[product.handle] ?? {
              urls: [],
              defaultUrl: null,
            };
            const defaultImage =
              imageSetting.defaultUrl ??
              product.image ??
              product.images?.[0] ??
              imageSetting.urls[0] ??
              null;
            const sourceImages = [product.image, ...(product.images ?? [])].filter(
              (image, index, values): image is string =>
                Boolean(image) && values.indexOf(image) === index,
            );
            const images = [...sourceImages, ...imageSetting.urls].filter(
              (image, index, values): image is string =>
                Boolean(image) && values.indexOf(image) === index,
            );
            const imageManagerOpen = expandedHandle === product.handle;
            const syncedEdit = syncedProductEdits[product.handle];
            return (
              <div className={styles.productEntry} key={product.handle}>
                <article className={styles.productRow}>
                  <div className={styles.productImage}>
                    {defaultImage && <img src={defaultImage} alt="" />}
                  </div>
                  <div className={styles.productCopy}>
                    <h2>{syncedEdit?.titleOverride || product.sourceTitle || product.title}</h2>
                    <p>
                      {syncedEdit?.category || product.type || "Vineyard Sun product"} ·{" "}
                      {product.source === "printful-api"
                        ? "David's Store"
                        : product.fulfillment === "printful"
                          ? "Legacy Printful"
                          : "Stocked at home"}
                    </p>
                    <button
                      aria-expanded={imageManagerOpen}
                      className={styles.imageToggle}
                      onClick={() => setExpandedHandle(imageManagerOpen ? null : product.handle)}
                      type="button"
                    >
                      {imageManagerOpen
                        ? "Close editor"
                        : product.source === "printful-api"
                          ? "Edit product"
                          : `Manage ${images.length} image${images.length === 1 ? "" : "s"}`}
                    </button>
                  </div>
                  <button
                    aria-checked={visible}
                    aria-label={`${visible ? "Hide" : "Show"} ${product.title}`}
                    className={`${styles.switch} ${visible ? styles.switchOn : ""}`}
                    onClick={() => toggleProduct(product.handle)}
                    role="switch"
                    type="button"
                  >
                    <span />
                  </button>
                  <strong className={visible ? styles.visible : styles.hidden}>
                    {visible ? "Visible" : "Hidden"}
                  </strong>
                </article>

                {imageManagerOpen && (
                  <section className={styles.imageManager} aria-label={`${product.title} images`}>
                    {syncedEdit && (
                      <div className={styles.productEditor}>
                        <div className={styles.imageManagerHeading}>
                          <h3>Storefront details</h3>
                          <p>
                            Printful keeps the production data. These fields control what
                            customers see on Vineyard Sun.
                          </p>
                        </div>
                        <div className={styles.editorGrid}>
                          <label>
                            <span>Product title</span>
                            <input
                              onChange={(event) =>
                                updateSyncedProduct(product.handle, (current) => ({
                                  ...current,
                                  titleOverride: event.target.value,
                                }))
                              }
                              value={syncedEdit.titleOverride ?? product.sourceTitle ?? product.title}
                            />
                          </label>
                          <label>
                            <span>Category</span>
                            <select
                              onChange={(event) =>
                                updateSyncedProduct(product.handle, (current) => ({
                                  ...current,
                                  category: event.target.value,
                                }))
                              }
                              value={syncedEdit.category}
                            >
                              <option>Apparel</option>
                              <option>Accessories</option>
                              <option>Home</option>
                              <option>Eyewear</option>
                            </select>
                          </label>
                          <label className={styles.descriptionField}>
                            <span>Description</span>
                            <textarea
                              onChange={(event) =>
                                updateSyncedProduct(product.handle, (current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              placeholder="Tell customers about this product…"
                              rows={6}
                              value={syncedEdit.description}
                            />
                          </label>
                        </div>
                        <div className={styles.priceEditor}>
                          <h4>Storefront prices</h4>
                          <p>Printful prices are used unless you enter an override.</p>
                          <div>
                            {product.variants.map((variant) => {
                              const override = syncedEdit.priceOverrides[String(variant.id)];
                              const sourcePrice = variant.sourcePrice ?? variant.price;
                              return (
                                <label key={variant.id}>
                                  <span>{variant.title}</span>
                                  <span className={styles.priceInput}>
                                    <b>$</b>
                                    <input
                                      min="0.50"
                                      onChange={(event) =>
                                        updatePriceOverride(product, variant.id, event.target.value)
                                      }
                                      step="0.01"
                                      type="number"
                                      value={((override ?? Math.round(sourcePrice * 100)) / 100).toFixed(2)}
                                    />
                                  </span>
                                  {override !== undefined && (
                                    <button
                                      onClick={() => resetPriceOverride(product, variant.id)}
                                      type="button"
                                    >
                                      Use Printful price
                                    </button>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={styles.imageManagerHeading}>
                      <h3>Product images</h3>
                      <p>Choose the default used on product cards and in the cart.</p>
                    </div>

                    {images.length > 0 && (
                      <div
                        aria-label="Default image"
                        className={styles.imageOptions}
                        role="radiogroup"
                      >
                        {images.map((imageUrl, index) => {
                          const selected = imageUrl === defaultImage;
                          const original = sourceImages.includes(imageUrl);
                          return (
                            <div
                              className={`${styles.imageOption} ${selected ? styles.imageOptionSelected : ""}`}
                              key={imageUrl}
                            >
                              <button
                                aria-checked={selected}
                                className={styles.imageChoice}
                                onClick={() => chooseDefaultImage(product, imageUrl)}
                                role="radio"
                                type="button"
                              >
                                <img src={imageUrl} alt={`${product.title} option ${index + 1}`} />
                                <span>{selected ? "Default" : "Make default"}</span>
                              </button>
                              <div className={styles.imageOptionMeta}>
                                <span>{original ? "Printful image" : `Added image ${index}`}</span>
                                {!original && (
                                  <button
                                    onClick={() => removeImageUrl(product, imageUrl)}
                                    type="button"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <form
                      className={styles.imageUrlForm}
                      onSubmit={(event) => addImageUrl(event, product)}
                    >
                      <label>
                        <span>Add image URL</span>
                        <input
                          onChange={(event) =>
                            setImageUrlDrafts((drafts) => ({
                              ...drafts,
                              [product.handle]: event.target.value,
                            }))
                          }
                          placeholder="https://cdn.example.com/product.jpg"
                          type="url"
                          value={imageUrlDrafts[product.handle] ?? ""}
                        />
                      </label>
                      <button type="submit">Add image</button>
                    </form>
                    <p className={styles.imageHelp}>
                      Use a direct HTTPS link ending in an image file or CDN image address.
                    </p>
                  </section>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
