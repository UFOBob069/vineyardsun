import fallbackConfig from "../app/data/merchandising.json";
import {
  normalizeProductImageSettings,
  type ProductImageSettings,
} from "../app/lib/product-image-settings";
import { getDb } from ".";

let schemaReady: Promise<unknown> | undefined;

async function ensureSchema() {
  const sql = getDb();

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS merchandising_settings (
        id TEXT PRIMARY KEY,
        hidden_handles JSONB NOT NULL DEFAULT '[]'::jsonb,
        product_images JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      ALTER TABLE merchandising_settings
      ADD COLUMN IF NOT EXISTS product_images JSONB NOT NULL DEFAULT '{}'::jsonb
    `;
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });

  await schemaReady;
}

export type MerchandisingSettings = {
  hiddenProductHandles: string[];
  productImageSettings: ProductImageSettings;
};

export async function getMerchandisingSettings(): Promise<MerchandisingSettings> {
  try {
    const sql = getDb();
    await ensureSchema();
    const rows = (await sql`
      SELECT hidden_handles, product_images
      FROM merchandising_settings
      WHERE id = 'storefront'
      LIMIT 1
    `) as Array<{ hidden_handles: unknown; product_images: unknown }>;
    const row = rows[0];
    const handles = row?.hidden_handles;

    return {
      hiddenProductHandles: Array.isArray(handles)
        ? handles.filter((handle): handle is string => typeof handle === "string")
        : fallbackConfig.hiddenProductHandles,
      productImageSettings: normalizeProductImageSettings(row?.product_images),
    };
  } catch {
    return {
      hiddenProductHandles: fallbackConfig.hiddenProductHandles,
      productImageSettings: {},
    };
  }
}

export async function replaceMerchandisingSettings({
  hiddenProductHandles,
  productImageSettings,
}: MerchandisingSettings) {
  const sql = getDb();
  await ensureSchema();
  const handlesJson = JSON.stringify([
    ...new Set(hiddenProductHandles.map((handle) => handle.trim()).filter(Boolean)),
  ]);
  const imagesJson = JSON.stringify(normalizeProductImageSettings(productImageSettings));

  await sql`
    INSERT INTO merchandising_settings (id, hidden_handles, product_images, updated_at)
    VALUES ('storefront', ${handlesJson}::jsonb, ${imagesJson}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET hidden_handles = EXCLUDED.hidden_handles,
        product_images = EXCLUDED.product_images,
        updated_at = NOW()
  `;
}
