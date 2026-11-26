export const CLIENT_EVENTS = ["page_view", "product_view", "variant_changed", "add_to_bag", "enquiry_started", "enquiry_error", "winery_cta_clicked"] as const;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function sessionId(value: unknown): string | null { return typeof value === "string" && UUID.test(value) ? value : null; }
export function publicPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  const path = value.split(/[?#]/)[0];
  return /^\/(?:products\/[a-z0-9-]{1,140}|custom-vineyard-sunglasses|shipping-returns|privacy)?$/.test(path) ? path : "/";
}
export function parseEvent(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid event.");
  const v = value as Record<string, unknown>;
  if (!sessionId(v.id) || !sessionId(v.sessionId) || !CLIENT_EVENTS.includes(v.name as typeof CLIENT_EVENTS[number])) throw new Error("Invalid event.");
  return { id: String(v.id), sessionId: String(v.sessionId), name: String(v.name), path: publicPath(v.path), funnel: v.funnel === "wholesale" ? "wholesale" : "retail", productHandle: typeof v.productHandle === "string" && /^[a-z0-9-]{1,140}$/.test(v.productHandle) ? v.productHandle : null, variantId: Number.isSafeInteger(v.variantId) && Number(v.variantId) > 0 ? Number(v.variantId) : null };
}
export function parseEnquiry(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Please complete the enquiry form.");
  const v = value as Record<string, unknown>;
  if (!sessionId(v.id)) throw new Error("Please refresh the form and try again.");
  const field = (key: string, max: number, required = true) => {
    const text = typeof v[key] === "string" ? v[key].trim() : "";
    if ((required && !text) || text.length > max) throw new Error(`Please check the ${key} field.`);
    return text;
  };
  const name = field("name", 120), email = field("email", 254).toLowerCase(), winery = field("winery", 160), quantity = field("quantity", 80, false), notes = field("notes", 3000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
  if (field("website", 200, false)) throw new Error("Please email info@vineyardsun.com to discuss your project.");
  return { id: String(v.id), sessionId: sessionId(v.sessionId), name, email, winery, quantity, notes };
}
