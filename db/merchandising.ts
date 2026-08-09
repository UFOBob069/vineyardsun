import fallbackConfig from "../app/data/merchandising.json";
import { getDb } from ".";

let schemaReady: Promise<unknown> | undefined;

async function ensureSchema() {
  const sql = getDb();

  schemaReady ??= Promise.resolve(sql`
    CREATE TABLE IF NOT EXISTS merchandising_settings (
      id TEXT PRIMARY KEY,
      hidden_handles JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch((error) => {
    schemaReady = undefined;
    throw error;
  });

  await schemaReady;
}

export async function getHiddenProductHandles(): Promise<string[]> {
  try {
    const sql = getDb();
    await ensureSchema();
    const rows = (await sql`
      SELECT hidden_handles
      FROM merchandising_settings
      WHERE id = 'storefront'
      LIMIT 1
    `) as Array<{ hidden_handles: unknown }>;
    const handles = rows[0]?.hidden_handles;

    return Array.isArray(handles)
      ? handles.filter((handle): handle is string => typeof handle === "string")
      : fallbackConfig.hiddenProductHandles;
  } catch {
    return fallbackConfig.hiddenProductHandles;
  }
}

export async function replaceHiddenProductHandles(handles: string[]) {
  const sql = getDb();
  await ensureSchema();
  const uniqueHandles = [...new Set(handles.map((handle) => handle.trim()).filter(Boolean))];
  const json = JSON.stringify(uniqueHandles);

  await sql`
    INSERT INTO merchandising_settings (id, hidden_handles, updated_at)
    VALUES ('storefront', ${json}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET hidden_handles = EXCLUDED.hidden_handles,
        updated_at = NOW()
  `;
}
