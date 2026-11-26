"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type EventRow = { name: string; funnel: string; events: number; sessions: number; value_cents: number };
type Enquiry = { id: string; name: string; email: string; winery: string; quantity: string; notes: string; status: string; created_at: string };
export function ConversionAdmin() {
  const [data, setData] = useState<{ events: EventRow[]; enquiries: Enquiry[] } | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false), [saving, setSaving] = useState<string | null>(null);
  async function load() { setLoading(true); setError(""); try { const response = await fetch("/api/admin/conversions", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to load report."); setData(result); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setLoading(false); } }
  // Fetch the protected report after hydration; no private data is rendered on the server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);
  async function update(id: string, status: string) {
    setSaving(id); setError("");
    try { const response = await fetch("/api/admin/conversions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); if (!response.ok) throw new Error("Update failed. Your previous status has been kept."); setData(current => current && ({ ...current, enquiries: current.enquiries.map(enquiry => enquiry.id === id ? { ...enquiry, status } : enquiry) })); }
    catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setSaving(null); }
  }
  return <main className="conversion-admin"><nav><Link href="/admin">← Product admin</Link><Link href="/">View store ↗</Link></nav><p className="eyebrow">Vineyard Sun</p><h1>Enquiries &amp; conversions</h1><p>Check this inbox for new custom-order enquiries. Submissions are saved here; email notifications are not configured.</p><button className="button button-dark" disabled={loading} onClick={load}>{loading ? "Refreshing…" : "Refresh"}</button>{error && <p role="alert" className="checkout-error">{error} <Link href="/admin">Sign in</Link></p>}
    {data && <><h2>Last 30 days</h2><p>Event counts and unique tab visits, separated by funnel. Purchases and submitted enquiries are confirmed on the server. Test activity is excluded. Counts start from this release; different stages are not necessarily the same cohort.</p>
      {(["retail", "wholesale"] as const).map(funnel => <section key={funnel}><h3>{funnel === "retail" ? "Retail purchases" : "Winery enquiries"}</h3><div className="report-table"><table><thead><tr><th>Action</th><th>Events</th><th>Unique visits</th><th>Order total</th></tr></thead><tbody>{data.events.filter(event => event.funnel === funnel).map(event => <tr key={event.name}><td>{event.name.replaceAll("_", " ")}</td><td>{event.events}</td><td>{event.sessions}</td><td>{event.name === "purchase" ? `$${(Number(event.value_cents) / 100).toFixed(2)}` : "—"}</td></tr>)}{!data.events.some(event => event.funnel === funnel) && <tr><td colSpan={4}>No activity recorded yet.</td></tr>}</tbody></table></div></section>)}
      <h2>Custom-order inbox</h2><p>Newest 100 enquiries · {data.enquiries.filter(enquiry => enquiry.status === "qualified").length} marked qualified in this list. Use “Qualified” after reviewing the project with the customer.</p>
      {!data.enquiries.length && <p>No enquiries yet.</p>}{data.enquiries.map(enquiry => <article className="enquiry-card" key={enquiry.id}><div><h3>{enquiry.winery}</h3><p>{enquiry.name} · <a href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`Your Vineyard Sun enquiry ${enquiry.id.slice(0, 8).toUpperCase()}`)}`}>{enquiry.email}</a></p><p>Quantity: {enquiry.quantity || "Not specified"} · {new Date(enquiry.created_at).toLocaleDateString("en-US")} · Ref {enquiry.id.slice(0, 8).toUpperCase()}</p><p className="enquiry-notes">{enquiry.notes}</p></div><label>Status<select value={enquiry.status} disabled={saving === enquiry.id} onChange={event => update(enquiry.id, event.target.value)}>{["new", "contacted", "qualified", "closed"].map(status => <option key={status}>{status}</option>)}</select></label></article>)}
    </>}
  </main>;
}
