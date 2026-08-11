import type { CatalogProduct } from "../app/lib/catalog";
import { addHiddenProductHandles } from "./merchandising";
import { getDb } from ".";

export const DAVIDS_PRINTFUL_STORE_ID = "18593823";

export type SyncedVariantInput = {
  id: number;
  title: string;
  priceCents: number;
  available: boolean;
  sku: string | null;
};

export type SyncedProductInput = {
  printfulProductId: string;
  externalId: string | null;
  sourceTitle: string;
  thumbnailUrl: string | null;
  sourceImages: string[];
  variants: SyncedVariantInput[];
};

export type SyncedProductEdit = {
  handle: string;
  titleOverride: string | null;
  description: string;
  category: string;
  priceOverrides: Record<string, number>;
};

type SyncedProductRow = {
  handle: string;
  printful_store_id: string;
  printful_product_id: string;
  external_id: string | null;
  source_title: string;
  title_override: string | null;
  description: string;
  category: string;
  thumbnail_url: string | null;
  source_images: unknown;
  variants: unknown;
  price_overrides: unknown;
  active: boolean;
};

let schemaReady: Promise<unknown> | undefined;

async function ensureSchema() {
  const sql = getDb();
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS printful_synced_products (
        handle TEXT PRIMARY KEY,
        printful_store_id TEXT NOT NULL,
        printful_product_id TEXT NOT NULL,
        external_id TEXT,
        source_title TEXT NOT NULL,
        title_override TEXT,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Apparel',
        thumbnail_url TEXT,
        source_images JSONB NOT NULL DEFAULT '[]'::jsonb,
        variants JSONB NOT NULL DEFAULT '[]'::jsonb,
        price_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        source_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (printful_store_id, printful_product_id)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS printful_synced_products_store_idx
      ON printful_synced_products (printful_store_id, active)
    `;
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  await schemaReady;
}

function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "printful-product"
  );
}

function inferredCategory(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("pillow") || normalized.includes("blanket")) return "Home";
  if (normalized.includes("hat") || normalized.includes("cap")) return "Accessories";
  return "Apparel";
}

function normalizedPriceOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, price]) =>
        /^\d+$/.test(key) &&
        typeof price === "number" &&
        Number.isSafeInteger(price) &&
        price >= 50 &&
        price <= 1_000_000,
    ),
  ) as Record<string, number>;
}

function mapRow(row: SyncedProductRow): CatalogProduct {
  const sourceVariants = Array.isArray(row.variants)
    ? (row.variants as SyncedVariantInput[])
    : [];
  const priceOverrides = normalizedPriceOverrides(row.price_overrides);
  const images = Array.isArray(row.source_images)
    ? row.source_images.filter((url): url is string => typeof url === "string")
    : [];

  return {
    id: Number(row.printful_product_id),
    title: row.title_override?.trim() || row.source_title,
    handle: row.handle,
    type: row.category,
    category: row.category,
    fulfillment: "printful",
    description: row.description,
    image: row.thumbnail_url ?? images[0] ?? null,
    images,
    available: sourceVariants.some((variant) => variant.available),
    variants: sourceVariants.map((variant) => {
      const sourcePrice = variant.priceCents / 100;
      return {
        id: variant.id,
        title: variant.title,
        price: (priceOverrides[String(variant.id)] ?? variant.priceCents) / 100,
        sourcePrice,
        compareAtPrice: null,
        available: variant.available,
        sku: variant.sku,
        printfulVariantId: String(variant.id),
        printfulVariantReference: "sync",
      };
    }),
    source: "printful-api",
    sourceTitle: row.source_title,
    titleOverride: row.title_override,
    priceOverrides,
    printfulStoreId: row.printful_store_id,
    printfulProductId: row.printful_product_id,
  };
}

export async function getSyncedCatalogProducts({
  includeInactive = false,
}: { includeInactive?: boolean } = {}) {
  const sql = getDb();
  await ensureSchema();
  const rows = (await sql`
    SELECT *
    FROM printful_synced_products
    WHERE active = TRUE OR ${includeInactive}
    ORDER BY created_at ASC
  `) as SyncedProductRow[];
  return rows.map(mapRow);
}

export async function upsertSyncedProducts(
  storeId: string,
  products: SyncedProductInput[],
) {
  if (storeId !== DAVIDS_PRINTFUL_STORE_ID) {
    throw new Error("Product sync is restricted to David's Store.");
  }
  const sql = getDb();
  await ensureSchema();
  const existingRows = (await sql`
    SELECT handle, printful_product_id
    FROM printful_synced_products
    WHERE printful_store_id = ${storeId}
  `) as Array<{ handle: string; printful_product_id: string }>;
  const existingByProductId = new Map(
    existingRows.map((row) => [row.printful_product_id, row.handle]),
  );
  const incomingIds = new Set(products.map((product) => product.printfulProductId));
  const newHandles: string[] = [];

  for (const product of products) {
    const handle =
      existingByProductId.get(product.printfulProductId) ??
      `${slugify(product.sourceTitle)}-pf-${product.printfulProductId}`;
    if (!existingByProductId.has(product.printfulProductId)) newHandles.push(handle);
    const imagesJson = JSON.stringify([...new Set(product.sourceImages)].slice(0, 20));
    const variantsJson = JSON.stringify(product.variants);
    const category = inferredCategory(product.sourceTitle);

    await sql`
      INSERT INTO printful_synced_products (
        handle, printful_store_id, printful_product_id, external_id,
        source_title, category, thumbnail_url, source_images, variants,
        active, source_updated_at, updated_at
      )
      VALUES (
        ${handle}, ${storeId}, ${product.printfulProductId}, ${product.externalId},
        ${product.sourceTitle}, ${category}, ${product.thumbnailUrl},
        ${imagesJson}::jsonb, ${variantsJson}::jsonb,
        TRUE, NOW(), NOW()
      )
      ON CONFLICT (printful_store_id, printful_product_id) DO UPDATE
      SET external_id = EXCLUDED.external_id,
          source_title = EXCLUDED.source_title,
          thumbnail_url = EXCLUDED.thumbnail_url,
          source_images = EXCLUDED.source_images,
          variants = EXCLUDED.variants,
          active = TRUE,
          source_updated_at = NOW(),
          updated_at = NOW()
    `;
  }

  for (const existing of existingRows) {
    if (!incomingIds.has(existing.printful_product_id)) {
      await sql`
        UPDATE printful_synced_products
        SET active = FALSE, updated_at = NOW()
        WHERE printful_store_id = ${storeId}
          AND printful_product_id = ${existing.printful_product_id}
      `;
    }
  }

  if (newHandles.length) await addHiddenProductHandles(newHandles);
  return {
    imported: products.length,
    added: newHandles.length,
    updated: products.length - newHandles.length,
    deactivated: existingRows.filter((row) => !incomingIds.has(row.printful_product_id))
      .length,
  };
}

export async function saveSyncedProductEdits(edits: SyncedProductEdit[]) {
  const sql = getDb();
  await ensureSchema();
  const validCategories = new Set(["Apparel", "Accessories", "Home", "Eyewear"]);

  for (const edit of edits) {
    const titleOverride = edit.titleOverride?.trim().slice(0, 160) || null;
    const description = edit.description.trim().slice(0, 6000);
    const category = validCategories.has(edit.category) ? edit.category : "Apparel";
    const priceOverridesJson = JSON.stringify(
      normalizedPriceOverrides(edit.priceOverrides),
    );
    await sql`
      UPDATE printful_synced_products
      SET title_override = ${titleOverride},
          description = ${description},
          category = ${category},
          price_overrides = ${priceOverridesJson}::jsonb,
          updated_at = NOW()
      WHERE handle = ${edit.handle}
        AND printful_store_id = ${DAVIDS_PRINTFUL_STORE_ID}
    `;
  }
}
