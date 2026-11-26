"use client";
import { useRef, useState, type FormEvent } from "react";
import { analyticsSession, track } from "../lib/analytics";
export function EnquiryForm() {
  const id = useRef<string | null>(null), started = useRef(false), lock = useRef(false);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [receipt, setReceipt] = useState("");
  const confirmation = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setPending(true); setError("");
    id.current ??= crypto.randomUUID();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, id: id.current, sessionId: analyticsSession() }) });
      const result = await response.json();
      if (!response.ok || !result.id) throw new Error(result.error || "Your enquiry couldn't be saved. Please try again.");
      setReceipt(result.id); requestAnimationFrame(() => confirmation.current?.focus());
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again or email info@vineyardsun.com."); track("enquiry_error", { funnel: "wholesale" }); }
    finally { setPending(false); lock.current = false; }
  }
  if (receipt) return <div className="enquiry-success" role="status" tabIndex={-1} ref={confirmation}><h3>Your enquiry is with us.</h3><p>Thank you. We&apos;ll review your project and contact you using the email you provided.</p><p>Reference: {receipt.slice(0, 8).toUpperCase()}</p><p>Need to add something? Email <a href="mailto:info@vineyardsun.com">info@vineyardsun.com</a> with this reference.</p></div>;
  return <form className="enquiry-form" onSubmit={submit} onFocus={() => { if (!started.current) { started.current = true; track("enquiry_started", { funnel: "wholesale" }); } }}>
    <div className="enquiry-fields"><label>Your name<input name="name" autoComplete="name" required maxLength={120} /></label><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>Winery / business name<input name="winery" autoComplete="organization" required maxLength={160} /></label><label><span>Approximate quantity <small>(optional)</small></span><input name="quantity" maxLength={80} placeholder="e.g. 100 pairs, or not sure yet" /></label></div>
    <label>Tell us about your project<textarea name="notes" required maxLength={3000} rows={5} placeholder="Your ideas, delivery country, target date, and anything else we should know." /></label>
    <div className="form-honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <p className="form-note">We&apos;ll use these details to respond to your enquiry. <a href="/privacy">Privacy details</a>. Sending an enquiry doesn&apos;t place an order or commit you to a purchase.</p>
    <button className="button button-dark" disabled={pending} type="submit">{pending ? "Sending your enquiry…" : "Send my enquiry ↗"}</button>
    {error && <p role="alert" className="checkout-error">{error}</p>}
  </form>;
}
