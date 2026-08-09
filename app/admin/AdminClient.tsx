"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import catalogData from "../data/catalog.json";
import styles from "./admin.module.css";

type Product = (typeof catalogData)[number];

export function AdminClient() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [hiddenHandles, setHiddenHandles] = useState<Set<string>>(new Set());
  const [savedHandles, setSavedHandles] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadVisibility = async () => {
    const response = await fetch("/api/merchandising", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load product visibility.");
    const data = (await response.json()) as { hiddenProductHandles: string[] };
    const next = new Set(data.hiddenProductHandles);
    setHiddenHandles(next);
    setSavedHandles(new Set(next));
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
        if (data.authenticated) await loadVisibility();
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
    if (!normalized) return catalogData;
    return catalogData.filter((product) =>
      `${product.title} ${product.type}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  const hasChanges =
    hiddenHandles.size !== savedHandles.size ||
    [...hiddenHandles].some((handle) => !savedHandles.has(handle));

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
      await loadVisibility();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setHiddenHandles(new Set());
    setSavedHandles(new Set());
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

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenProductHandles: [...hiddenHandles] }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (response.status === 401) setAuthenticated(false);
        throw new Error(data.error ?? "Could not save changes.");
      }
      setSavedHandles(new Set(hiddenHandles));
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
            <p>{catalogData.length - hiddenHandles.size} visible · {hiddenHandles.size} hidden</p>
          </div>
          <button
            className={styles.saveButton}
            disabled={!hasChanges || saving}
            onClick={save}
            type="button"
          >
            {saving ? "Saving…" : hasChanges ? "Save changes" : "Saved"}
          </button>
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
              onClick={() => setHiddenHandles(new Set(catalogData.map((product) => product.handle)))}
            >
              Hide all
            </button>
          </div>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.productList}>
          {filteredProducts.map((product: Product) => {
            const visible = !hiddenHandles.has(product.handle);
            return (
              <article className={styles.productRow} key={product.handle}>
                <div className={styles.productImage}>
                  {product.image && <img src={product.image} alt="" />}
                </div>
                <div className={styles.productCopy}>
                  <h2>{product.title}</h2>
                  <p>{product.type || "Vineyard Sun product"} · {product.fulfillment === "printful" ? "Made to order" : "Stocked at home"}</p>
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
            );
          })}
        </div>
      </section>
    </main>
  );
}
