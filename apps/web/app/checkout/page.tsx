import type { Metadata } from "next";
import Link from "next/link";
import { formatProductPrice, productDetailPath } from "@/lib/products";
import { loadCart } from "@/lib/cart";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Checkout | Sports Jersey House",
  description: "Secure checkout for your Sports Jersey House order.",
  path: "/checkout",
  noIndex: true
});

export default async function CheckoutPage() {
  const cart = await loadCart();

  if (cart.items.length === 0) {
    return (
      <main className="page-shell">
        <section className="empty-state">
          <p className="eyebrow">Checkout</p>
          <h1>Your cart is empty</h1>
          <p>Add jerseys to your cart before checking out.</p>
          <div className="actions">
            <Link className="button primary" href="/products">
              Shop products
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Checkout</p>
        <h1>Review your order</h1>
        <p>Stripe payment will connect in a later phase. This page confirms your cart before payment.</p>
      </div>

      <section className="checkout-layout" aria-label="Checkout">
        <div className="checkout-items">
          <h2 className="visually-hidden">Order items</h2>
          <ul className="cart-items">
            {cart.items.map((item) => (
              <li className="cart-item checkout-item" key={item.id}>
                <div className="cart-item-media">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={item.productTitle} height={120} src={item.imageUrl} width={90} />
                  ) : (
                    <div className="product-card-fallback" aria-hidden="true">
                      SJH
                    </div>
                  )}
                </div>
                <div className="cart-item-body">
                  <Link href={productDetailPath(item.productSlug)}>
                    <h3>{item.productTitle}</h3>
                  </Link>
                  <p>
                    {item.variantTitle} · Qty {item.quantity}
                  </p>
                </div>
                <p className="cart-item-total">
                  {formatProductPrice(item.lineTotalAmount, item.currencyCode)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="checkout-summary cart-summary">
          <h2>Order total</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatProductPrice(cart.subtotalAmount, cart.currencyCode)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>Calculated at payment</dd>
            </div>
          </dl>
          <p className="cart-note">
            Payments will be processed securely through Stripe. Tax and shipping are finalised at checkout.
          </p>
          <button type="button" className="button primary checkout-cta" disabled>
            Pay with Stripe — coming soon
          </button>
          <Link className="button secondary" href="/cart">
            Back to cart
          </Link>
        </aside>
      </section>
    </main>
  );
}
