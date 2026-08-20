"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CartLineControlsProps = {
  itemId: string;
  quantity: number;
};

export function CartLineControls({ itemId, quantity }: CartLineControlsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateQuantity(nextQuantity: number) {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: nextQuantity })
    });

    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Could not update cart.");
      return;
    }

    window.dispatchEvent(new Event("sjh:cart-updated"));
    router.refresh();
  }

  async function removeItem() {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });

    setBusy(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Could not remove item.");
      return;
    }

    window.dispatchEvent(new Event("sjh:cart-updated"));
    router.refresh();
  }

  return (
    <div className="cart-line-controls">
      <div className="cart-qty" aria-label="Quantity">
        <button
          type="button"
          className="button ghost compact"
          disabled={busy || quantity <= 1}
          aria-label="Decrease quantity"
          onClick={() => updateQuantity(quantity - 1)}
        >
          −
        </button>
        <span aria-live="polite">{quantity}</span>
        <button
          type="button"
          className="button ghost compact"
          disabled={busy || quantity >= 99}
          aria-label="Increase quantity"
          onClick={() => updateQuantity(quantity + 1)}
        >
          +
        </button>
      </div>
      <button type="button" className="button ghost compact" disabled={busy} onClick={removeItem}>
        Remove
      </button>
      {error ? <p className="cart-line-error">{error}</p> : null}
    </div>
  );
}
