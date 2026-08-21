"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Route } from "next";
import type { GuestCheckoutInput } from "@sjh/shared";

type CheckoutFormProps = {
  currencyCode: string;
  subtotalLabel: string;
};

type AddressState = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: "US" | "CA";
};

const emptyAddress: AddressState = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US"
};

export function CheckoutForm({ currencyCode, subtotalLabel }: CheckoutFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState<AddressState>(emptyAddress);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abandonTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!email && !phone) {
      return;
    }

    if (abandonTimer.current) {
      window.clearTimeout(abandonTimer.current);
    }

    abandonTimer.current = window.setTimeout(() => {
      void fetch("/api/checkout/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          shippingAddress: {
            ...(address.fullName ? { fullName: address.fullName } : {}),
            ...(address.line1 ? { line1: address.line1 } : {}),
            ...(address.city ? { city: address.city } : {}),
            ...(address.region ? { region: address.region } : {}),
            ...(address.postalCode ? { postalCode: address.postalCode } : {}),
            country: address.country
          }
        })
      });
    }, 1200);

    return () => {
      if (abandonTimer.current) {
        window.clearTimeout(abandonTimer.current);
      }
    };
  }, [email, phone, address]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: GuestCheckoutInput = {
      email,
      phone,
      shippingAddress: {
        fullName: address.fullName,
        line1: address.line1,
        ...(address.line2 ? { line2: address.line2 } : {}),
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        country: address.country
      },
      ...(notes ? { customerNotes: notes } : {})
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as { orderNumber?: string; error?: string };

      if (!response.ok || !data.orderNumber) {
        setError(data.error ?? "Could not place order.");
        return;
      }

      window.dispatchEvent(new Event("sjh:cart-updated"));
      router.push(`/orders/${encodeURIComponent(data.orderNumber)}` as Route);
      router.refresh();
    } catch {
      setError("Could not place order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      <fieldset>
        <legend>Contact</legend>
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
        <label className="field">
          <span>Phone</span>
          <input
            autoComplete="tel"
            onChange={(event) => setPhone(event.target.value)}
            required
            type="tel"
            value={phone}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Shipping</legend>
        <label className="field">
          <span>Full name</span>
          <input
            autoComplete="name"
            onChange={(event) => setAddress((prev) => ({ ...prev, fullName: event.target.value }))}
            required
            type="text"
            value={address.fullName}
          />
        </label>
        <label className="field">
          <span>Address line 1</span>
          <input
            autoComplete="address-line1"
            onChange={(event) => setAddress((prev) => ({ ...prev, line1: event.target.value }))}
            required
            type="text"
            value={address.line1}
          />
        </label>
        <label className="field">
          <span>Address line 2 (optional)</span>
          <input
            autoComplete="address-line2"
            onChange={(event) => setAddress((prev) => ({ ...prev, line2: event.target.value }))}
            type="text"
            value={address.line2}
          />
        </label>
        <div className="checkout-form-row">
          <label className="field">
            <span>City</span>
            <input
              autoComplete="address-level2"
              onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))}
              required
              type="text"
              value={address.city}
            />
          </label>
          <label className="field">
            <span>State / province</span>
            <input
              autoComplete="address-level1"
              onChange={(event) => setAddress((prev) => ({ ...prev, region: event.target.value }))}
              required
              type="text"
              value={address.region}
            />
          </label>
        </div>
        <div className="checkout-form-row">
          <label className="field">
            <span>Postal code</span>
            <input
              autoComplete="postal-code"
              onChange={(event) => setAddress((prev) => ({ ...prev, postalCode: event.target.value }))}
              required
              type="text"
              value={address.postalCode}
            />
          </label>
          <label className="field">
            <span>Country</span>
            <select
              onChange={(event) =>
                setAddress((prev) => ({
                  ...prev,
                  country: event.target.value === "CA" ? "CA" : "US"
                }))
              }
              value={address.country}
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </select>
          </label>
        </div>
      </fieldset>

      <label className="field">
        <span>Order notes (optional)</span>
        <textarea
          maxLength={500}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          value={notes}
        />
      </label>

      <aside className="checkout-summary cart-summary">
        <h2>Order total</h2>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{subtotalLabel}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>Calculated later</dd>
          </div>
          <div>
            <dt>Total ({currencyCode})</dt>
            <dd>{subtotalLabel}</dd>
          </div>
        </dl>
        <p className="cart-note">
          Stripe payment connects in a later phase. Placing an order records it as awaiting payment with your
          customisation attached to each line.
        </p>
        {error ? (
          <p className="add-to-cart-message is-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button primary checkout-cta" disabled={submitting} type="submit">
          {submitting ? "Placing order…" : "Place order"}
        </button>
      </aside>
    </form>
  );
}
