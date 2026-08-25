import type { Metadata } from "next";
import Link from "next/link";
import { formatCustomisationSummary } from "@sjh/shared";
import { CheckoutForm } from "@/components/checkout-form";
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
        <h1>Complete your order</h1>
        <p>Enter contact and shipping details. Customisation on each jersey is saved with your order.</p>
      </div>

      <section className="checkout-layout" aria-label="Checkout">
        <div className="checkout-items">
          <h2>Order items</h2>
          <ul className="cart-items">
            {cart.items.map((item) => {
              const summaryLines =
                item.optionsSummary && item.optionsSummary.length > 0
                  ? item.optionsSummary
                  : [
                      ...(item.colourLabel ? [`Colour: ${item.colourLabel}`] : []),
                      ...(item.sizeLabel ? [`Size: ${item.sizeLabel}`] : [item.variantTitle]),
                      ...(formatCustomisationSummary(item.customisation)
                        ? [formatCustomisationSummary(item.customisation)!]
                        : [])
                    ];

              return (
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
                    <p>Qty {item.quantity}</p>
                    {summaryLines.map((line) => (
                      <p className="cart-item-customisation" key={line}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <p className="cart-item-total">
                    {formatProductPrice(item.lineTotalAmount, item.currencyCode)}
                  </p>
                </li>
              );
            })}
          </ul>
          <Link className="button secondary" href="/cart">
            Back to cart
          </Link>
        </div>

        <CheckoutForm
          currencyCode={cart.currencyCode}
          subtotalLabel={formatProductPrice(cart.subtotalAmount, cart.currencyCode)}
        />
      </section>
    </main>
  );
}
