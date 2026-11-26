import { createHmac } from "node:crypto";
import { getDb } from ".";
import type { parseEnquiry } from "../app/lib/conversion-validation";
let ready: Promise<unknown> | undefined;
export async function ensureConversions() {
  const sql = getDb();
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS conversion_events (id TEXT PRIMARY KEY, session_id TEXT, name TEXT NOT NULL, funnel TEXT NOT NULL, path TEXT NOT NULL, product_handle TEXT, variant_id BIGINT, value_cents INTEGER, is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE INDEX IF NOT EXISTS conversion_events_time_idx ON conversion_events(created_at)`;
    await sql`CREATE TABLE IF NOT EXISTS vineyard_enquiries (id TEXT PRIMARY KEY, session_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, winery TEXT NOT NULL, quantity TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS storefront_request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`;
  })().catch(error => { ready = undefined; throw error; });
  await ready;
}
export function isConversionTest() { return process.env.CONVERSION_TEST_MODE === "true" || process.env.NODE_ENV !== "production" || (Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production"); }
export async function allowRequest(request: Request, kind: "enquiry" | "event") {
  await ensureConversions();
  const sql = getDb();
  const interval = kind === "enquiry" ? 3600000 : 60000;
  const bucket = Math.floor(Date.now() / interval);
  // Keep only a keyed, rotating digest; never retain the visitor's IP address.
  const address = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const key = createHmac("sha256", process.env.ADMIN_PASSWORD || process.env.DATABASE_URL || "local").update(`${kind}:${bucket}:${address}`).digest("hex");
  const rows = await sql`INSERT INTO storefront_request_limits (key, count, expires_at) VALUES (${key}, 1, ${new Date((bucket + 1) * interval).toISOString()}::timestamptz) ON CONFLICT (key) DO UPDATE SET count = storefront_request_limits.count + 1 RETURNING count`;
  await sql`DELETE FROM storefront_request_limits WHERE expires_at < NOW()`;
  return Number((rows as { count: number }[])[0].count) <= (kind === "enquiry" ? 10 : 180);
}
type Event = { id: string; sessionId?: string | null; name: string; funnel: string; path: string; productHandle?: string | null; variantId?: number | null; valueCents?: number; isTest?: boolean };
export async function recordConversion(event: Event) {
  await ensureConversions();
  const sql = getDb();
  await sql`INSERT INTO conversion_events (id, session_id, name, funnel, path, product_handle, variant_id, value_cents, is_test) VALUES (${event.id}, ${event.sessionId ?? null}, ${event.name}, ${event.funnel}, ${event.path}, ${event.productHandle ?? null}, ${event.variantId ?? null}, ${event.valueCents ?? null}, ${event.isTest ?? isConversionTest()}) ON CONFLICT (id) DO NOTHING`;
}
export async function saveEnquiry(enquiry: ReturnType<typeof parseEnquiry>) {
  await ensureConversions();
  const sql = getDb(), test = isConversionTest();
  // One statement makes the stored enquiry and its submission event atomic.
  await sql`WITH saved AS (
    INSERT INTO vineyard_enquiries (id, session_id, name, email, winery, quantity, notes, is_test)
    VALUES (${enquiry.id}, ${enquiry.sessionId}, ${enquiry.name}, ${enquiry.email}, ${enquiry.winery}, ${enquiry.quantity}, ${enquiry.notes}, ${test})
    ON CONFLICT (id) DO NOTHING RETURNING id, session_id
  ) INSERT INTO conversion_events (id, session_id, name, funnel, path, is_test)
    SELECT 'enquiry:' || id, session_id, 'enquiry_submitted', 'wholesale', '/custom-vineyard-sunglasses', ${test} FROM saved ON CONFLICT (id) DO NOTHING`;
}
export async function conversionReport() {
  await ensureConversions();
  const sql = getDb();
  const [events, enquiries] = await Promise.all([
    sql`SELECT name, funnel, COUNT(*)::int AS events, COUNT(DISTINCT session_id)::int AS sessions, COALESCE(SUM(value_cents), 0)::bigint AS value_cents FROM conversion_events WHERE created_at >= NOW() - INTERVAL '30 days' AND is_test = FALSE GROUP BY name, funnel ORDER BY funnel, name`,
    sql`SELECT id, name, email, winery, quantity, notes, status, created_at FROM vineyard_enquiries WHERE is_test = FALSE ORDER BY created_at DESC LIMIT 100`,
  ]);
  return { events, enquiries };
}
export async function updateEnquiry(id: string, status: string) {
  await ensureConversions();
  const sql = getDb();
  const rows = await sql`UPDATE vineyard_enquiries SET status = ${status} WHERE id = ${id} RETURNING id`;
  return (rows as { id: string }[]).length > 0;
}
