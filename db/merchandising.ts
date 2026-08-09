import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import fallbackConfig from "../app/data/merchandising.json";
import { getDb } from ".";
import { productVisibility } from "./schema";

type RuntimeEnv = {
  DB?: D1Database;
};

export async function getHiddenProductHandles(): Promise<string[]> {
  try {
    const rows = await getDb()
      .select({ handle: productVisibility.handle })
      .from(productVisibility)
      .where(eq(productVisibility.visible, false));
    return rows.map((row) => row.handle);
  } catch {
    return fallbackConfig.hiddenProductHandles;
  }
}

export async function replaceHiddenProductHandles(handles: string[]) {
  const database = (env as unknown as RuntimeEnv).DB;
  if (!database) throw new Error("Product storage is unavailable.");

  const uniqueHandles = [...new Set(handles.map((handle) => handle.trim()).filter(Boolean))];
  const statements = [database.prepare("DELETE FROM product_visibility")];

  for (const handle of uniqueHandles) {
    statements.push(
      database
        .prepare(
          "INSERT INTO product_visibility (handle, visible, updated_at) VALUES (?, 0, CURRENT_TIMESTAMP)",
        )
        .bind(handle),
    );
  }

  await database.batch(statements);
}
