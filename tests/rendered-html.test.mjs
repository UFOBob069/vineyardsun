import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("ships the requested Vineyard Sun storefront structure", async () => {
  const [storefront, layout] = await Promise.all([
    readFile(new URL("../app/Storefront.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Vineyard Sun \| Cork Eyewear & Conversation Pieces/);
  assert.match(storefront, /The wine lover&apos;s eyewear/);
  assert.match(storefront, /Happiness is positive cash flow/);
  assert.match(storefront, /Add bestseller to bag/);
  assert.match(storefront, /About Vineyard Sun/);
  assert.match(storefront, /Shared around the table/);
  assert.match(storefront, /Wine-country originals/);
  assert.match(storefront, /I have worn these non-stop since they arrived/);
  assert.match(storefront, /The frame material is extraordinarily lightweight/);
  assert.doesNotMatch(storefront, /Secure Shopify checkout|Powered by Shopify|Checkout with Shopify/i);
  assert.match(storefront, /Open shopping bag/);
  assert.ok(storefront.indexOf("Happiness is positive cash flow") > storefront.indexOf("The wine lover"));
  assert.ok(storefront.indexOf("About Vineyard Sun") > storefront.indexOf("Seen in the wild"));
  assert.doesNotMatch(storefront, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships a complete local catalog snapshot and Stripe checkout adapter", async () => {
  const [catalogText, merchandisingText, storefront, checkout, webhook, printful, orders, packageJson, productImages, brandImages] =
    await Promise.all([
      readFile(new URL("../app/data/catalog.json", import.meta.url), "utf8"),
      readFile(new URL("../app/data/merchandising.json", import.meta.url), "utf8"),
      readFile(new URL("../app/Storefront.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/checkout/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/printful.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/orders.ts", import.meta.url), "utf8"),
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
  assert.doesNotMatch(storefront, /vineyardsun\.myshopify\.com/);
  assert.match(storefront, /fetch\("\/api\/checkout"/);
  assert.match(checkout, /checkout\.sessions\.create/);
  assert.match(checkout, /findCatalogVariant/);
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /request\.text\(\)/);
  assert.match(webhook, /PRINTFUL_ALLOW_TEST_ORDERS/);
  assert.match(printful, /external_variant_id/);
  assert.match(printful, /createHash\("sha256"\)/);
  assert.match(printful, /slice\(0, 29\)/);
  assert.doesNotMatch(printful, /external_id: `\$\{orderId\}-\$\{line\.variantId\}`/);
  assert.match(printful, /confirm=1&update_existing=true/);
  assert.match(orders, /storefront_orders/);
  assert.match(orders, /stripe_session_id TEXT UNIQUE/);
  assert.match(packageJson, /"stripe"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("includes a password-protected persistent product admin", async () => {
  const [adminClient, adminAuth, productsRoute, database, merchandising, environment, storefront] =
    await Promise.all([
      readFile(new URL("../app/admin/AdminClient.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/admin-auth.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/products/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/merchandising.ts", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../app/Storefront.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(adminClient, /Save changes/);
  assert.match(adminClient, /role="switch"/);
  assert.match(adminClient, /Add image URL/);
  assert.match(adminClient, /role="radio"/);
  assert.match(adminClient, /productImageSettings/);
  assert.match(adminAuth, /ADMIN_PASSWORD/);
  assert.match(adminAuth, /HttpOnly; Secure; SameSite=Strict/);
  assert.doesNotMatch(adminAuth, /length\s*[<>]=?\s*12/);
  assert.doesNotMatch(adminClient, /minLength=\{12\}|at least\s+12 characters/i);
  assert.match(productsRoute, /requestIsAdmin/);
  assert.match(database, /@neondatabase\/serverless/);
  assert.match(database, /DATABASE_URL/);
  assert.match(merchandising, /merchandising_settings/);
  assert.match(merchandising, /product_images/);
  assert.match(storefront, /initialProductImageSettings/);
  assert.match(storefront, /dialog-thumbnails/);
  assert.match(environment, /DATABASE_URL=postgresql:/);
});

test("isolates the Manual API store sync and preserves multi-store fulfillment", async () => {
  const [syncRoute, syncService, syncedProducts, adminClient, checkout, webhook, printful, environment] =
    await Promise.all([
      readFile(new URL("../app/api/admin/printful-sync/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/printful-sync.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/synced-products.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/AdminClient.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/checkout/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/lib/printful.ts", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
    ]);

  assert.match(syncRoute, /requestIsAdmin/);
  assert.match(syncService, /\/store\/products/);
  assert.match(syncService, /cache: "no-store"/);
  assert.match(syncedProducts, /DAVIDS_PRINTFUL_STORE_ID = "18593823"/);
  assert.match(syncedProducts, /addHiddenProductHandles/);
  assert.match(syncedProducts, /ON CONFLICT \(printful_store_id, printful_product_id\)/);
  assert.match(adminClient, /Sync David's Store/);
  assert.match(adminClient, /Storefront details/);
  assert.match(adminClient, /Use Printful price/);
  assert.match(checkout, /getSyncedCatalogProducts/);
  assert.match(webhook, /linesByStore/);
  assert.match(printful, /sync_variant_id/);
  assert.match(environment, /PRINTFUL_SYNC_STORE_ID=18593823/);
});
