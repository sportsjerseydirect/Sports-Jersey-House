import type { Route } from "next";
import type { Metadata } from "next";
import Link from "next/link";
import { formatCustomisationSummary } from "@sjh/shared";
import { CartLineControls } from "@/components/cart-line-controls";
import { formatProductPrice, productDetailPath } from "@/lib/products";
import { loadCart } from "@/lib/cart";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Cart | Sports Jersey House",
  description: "Your shopping cart at Sports Jersey House.",
  path: "/cart"
});

export default async function CartPage() {
  const cart = await loadCart();

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Cart</p>
        <h1>Your cart</h1>
        <p>{cart.itemCount > 0 ? `${cart.itemCount} items ready for checkout.` : "Your cart is empty."}</p>
      </div>

      {cart.items.length > 0 ? (
        <section className="cart-layout" aria-label="Cart items">
          <ul className="cart-items">
            {cart.items.map((item) => {
              const customisationSummary = formatCustomisationSummary(item.customisation);
              const unitWithCustomisation = (
                Number.parseFloat(item.priceAmount) + Number.parseFloat(item.customisationPriceAmount)
              ).toFixed(2);

              return (
                <li className="cart-item" key={item.id}>
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
                      <h2>{item.productTitle}</h2>
                    </Link>
                    <p>{item.variantTitle}</p>
                    {customisationSummary ? <p className="cart-item-customisation">{customisationSummary}</p> : null}
                    <p>
                      {formatProductPrice(unitWithCustomisation, item.currencyCode)} each
                      {Number.parseFloat(item.customisationPriceAmount) > 0
                        ? ` (incl. ${formatProductPrice(item.customisationPriceAmount, item.currencyCode)} customisation)`
                        : ""}
                    </p>
                    <CartLineControls itemId={item.id} quantity={item.quantity} />
                  </div>
                  <p className="cart-item-total">
                    {formatProductPrice(item.lineTotalAmount, item.currencyCode)}
                  </p>
                </li>
              );
            })}
          </ul>

          <aside className="cart-summary">
            <h2>Order summary</h2>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatProductPrice(cart.subtotalAmount, cart.currencyCode)}</dd>
              </div>
            </dl>
            <p className="cart-note">Checkout records your order and customisation. Stripe payment connects later.</p>
            <Link className="button primary" href={"/checkout" as Route}>
              Proceed to checkout
            </Link>
            <Link className="button secondary" href="/products">
              Continue shopping
            </Link>
          </aside>
        </section>
      ) : (
        <section className="empty-state">
          <h2>Cart is empty</h2>
          <p>Browse the catalogue and add a jersey to get started.</p>
          <div className="actions">
            <Link className="button primary" href="/products">
              Shop products
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
