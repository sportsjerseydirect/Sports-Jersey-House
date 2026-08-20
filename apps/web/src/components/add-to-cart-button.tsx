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
  const [justAdded, setJustAdded] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setMessage(null);
    setJustAdded(false);

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: 1 })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setMessage(payload.error ?? "Could not add to cart.");
        return;
      }

      setMessage("Added to cart.");
      setJustAdded(true);
      window.dispatchEvent(new Event("sjh:cart-updated"));
      router.refresh();
      window.setTimeout(() => setJustAdded(false), 900);
    } catch {
      setMessage("Could not add to cart.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`add-to-cart${justAdded ? " is-added" : ""}`}>
      <button className="button primary" disabled={disabled || submitting} onClick={handleClick} type="button">
        {submitting ? "Adding…" : justAdded ? "Added" : "Add to cart"}
      </button>
      {message ? <p className="add-to-cart-message" role="status">{message}</p> : null}
    </div>
  );
}
