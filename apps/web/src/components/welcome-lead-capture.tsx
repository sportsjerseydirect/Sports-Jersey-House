"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "sjh_welcome_lead_dismissed";

export function WelcomeLeadCapture() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isOpsSurface =
    pathname.startsWith("/admin") || pathname.startsWith("/supplier");

  const isPurchaseFlow =
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/products/");

  useEffect(() => {
    if (isOpsSurface || isPurchaseFlow) {
      setOpen(false);
      return;
    }

    try {
      if (window.localStorage.getItem(STORAGE_KEY)) {
        return;
      }
    } catch {
      // ignore storage failures
    }

    const timer = window.setTimeout(() => setOpen(true), 4500);
    return () => window.clearTimeout(timer);
  }, [isOpsSurface, isPurchaseFlow]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "popup", offerCode: "WELCOME10" })
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }
      setMessage(data.message ?? "Saved.");
      window.setTimeout(dismiss, 1200);
    } catch {
      setMessage("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (isOpsSurface || isPurchaseFlow || !open) {
    return null;
  }

  return (
    <div aria-modal="true" className="lead-capture-overlay" role="dialog">
      <div className="lead-capture-panel">
        <button aria-label="Close" className="lead-capture-close" onClick={dismiss} type="button">
          ×
        </button>
        <p className="eyebrow">First visit offer</p>
        <h2>10% off your first jersey</h2>
        <p>Leave your email for code WELCOME10. No spam — unsubscribe anytime.</p>
        <form onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "Saving…" : "Get 10% off"}
          </button>
        </form>
        {message ? <p role="status">{message}</p> : null}
      </div>
    </div>
  );
}
