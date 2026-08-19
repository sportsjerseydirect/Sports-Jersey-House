"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AddToCartButtonProps = {
  variantId: string;
  disabled?: boolean;
};

export function AddToCartButton({ variantId, disabled = false }: AddToCartButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, quantity: 1 })
    });

    setSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error ?? "Could not add to cart.");
      return;
    }

    setMessage("Added to cart.");
    router.refresh();
  }

  return (
    <div className="add-to-cart">
      <button className="button primary" disabled={disabled || submitting} onClick={handleClick} type="button">
        {submitting ? "Adding…" : "Add to cart"}
      </button>
      {message ? <p className="add-to-cart-message">{message}</p> : null}
    </div>
  );
}
