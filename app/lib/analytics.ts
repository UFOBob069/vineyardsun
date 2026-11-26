"use client";
export function analyticsSession(): string | null {
  if (typeof window === "undefined" || navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return null;
  try {
    let id = sessionStorage.getItem("vs-visit");
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("vs-visit", id); }
    return id;
  } catch { return null; }
}
export function track(name: string, details: { productHandle?: string; variantId?: number; funnel?: "retail" | "wholesale" } = {}) {
  const sessionId = analyticsSession();
  if (!sessionId) return;
  const event = { id: crypto.randomUUID(), sessionId, name, path: location.pathname, funnel: location.pathname === "/custom-vineyard-sunglasses" ? "wholesale" : "retail", ...details };
  void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true }).catch(() => undefined);
}
