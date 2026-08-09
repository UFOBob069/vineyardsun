import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Vineyard Sun storefront", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vineyard Sun \| Cork Eyewear &amp; Conversation Pieces<\/title>/i);
  assert.match(html, /Happiness is positive cash flow/);
  assert.match(html, /Add bestseller to bag/);
  assert.match(html, /About Vineyard Sun/);
  assert.match(html, /Shared around the table/);
  assert.doesNotMatch(html, />[^<]*Shopify[^<]*</i);
  assert.match(html, /Open shopping bag/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships a complete local catalog snapshot and checkout adapter", async () => {
  const [catalogText, merchandisingText, storefront, packageJson, productImages, brandImages] =
    await Promise.all([
      readFile(new URL("../app/data/catalog.json", import.meta.url), "utf8"),
      readFile(new URL("../app/data/merchandising.json", import.meta.url), "utf8"),
      readFile(new URL("../app/Storefront.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readdir(new URL("../public/products/", import.meta.url)),
      readdir(new URL("../public/brand/", import.meta.url)),
    ]);

  const catalog = JSON.parse(catalogText);
  const merchandising = JSON.parse(merchandisingText);
  assert.equal(catalog.length, 25);
  assert.equal(productImages.length, 25);
  assert.ok(brandImages.includes("hero.jpg"));
  assert.ok(brandImages.includes("partners.png"));
  assert.ok(brandImages.includes("founder.png"));
  assert.equal(
    merchandising.featuredProductHandle,
    "premium-icahn-happiness-is-positive-cashflow-decorative-pillow",
  );
  assert.ok(catalog.some((product) => product.fulfillment === "printful"));
  assert.ok(catalog.some((product) => product.fulfillment === "local"));
  assert.match(storefront, /vineyardsun\.myshopify\.com/);
  assert.match(storefront, /\/cart\/\$\{cartDetails/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
