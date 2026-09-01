"use client";

import { useState } from "react";
import type { ProductDetail, ProductVariantSummary } from "@sjh/shared";
import { resolveImageIndexForColour } from "@sjh/shared";
import { PdpMadeToOrderNotice } from "@/components/pdp-made-to-order-notice";
import { ProductGallery } from "@/components/product-gallery";
import { PdpPurchasePanel } from "@/components/pdp-purchase-panel";

type ProductDetailInteractiveProps = {
  product: ProductDetail;
};

function initialVariantId(
  variants: ProductVariantSummary[],
  images: Array<{ url: string; altText?: string | null }>
): string {
  const available = variants.filter((variant) => variant.isAvailable);
  if (available.length === 0) {
    return variants[0]?.id ?? "";
  }

  if (images.length > 0) {
    for (const variant of available) {
      if (resolveImageIndexForColour(images, variant.colourLabel) === 0) {
        return variant.id;
      }
    }
  }

  return available[0]?.id ?? variants[0]?.id ?? "";
}

function toImageRefs(images: ProductDetail["images"]) {
  return images.map((image) => ({
    url: image.url,
    altText: image.altText ?? null
  }));
}

export function ProductDetailInteractive({ product }: ProductDetailInteractiveProps) {
  const imageRefs = toImageRefs(product.images);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState(() =>
    initialVariantId(product.variants, imageRefs)
  );

  const metaBits = [product.league, product.team, product.playerName].filter(Boolean);

  function handleVariantChange(variantId: string) {
    setSelectedVariantId(variantId);
    const variant = product.variants.find((entry) => entry.id === variantId);
    if (variant?.colourLabel) {
      const index = resolveImageIndexForColour(imageRefs, variant.colourLabel);
      setGalleryIndex(index);
    }
  }

  return (
    <>
      <ProductGallery
        activeIndex={galleryIndex}
        images={product.images}
        onActiveIndexChange={setGalleryIndex}
        title={product.title}
      />

      <div className="product-detail-copy">
        {metaBits.length > 0 ? <p className="eyebrow">{metaBits.join(" · ")}</p> : null}
        <h1>{product.title}</h1>
        <PdpMadeToOrderNotice />
        {product.description ? <p className="product-detail-description">{product.description}</p> : null}

        <PdpPurchasePanel
          customisationEnabled={product.customisationEnabled}
          {...(product.customisationProfile ? { customisationProfile: product.customisationProfile } : {})}
          {...(product.productOptions ? { productOptions: product.productOptions } : {})}
          onVariantChange={handleVariantChange}
          productTitle={product.title}
          selectedVariantId={selectedVariantId}
          {...(product.sizeChart ? { sizeChart: product.sizeChart } : {})}
          variants={product.variants}
        />
      </div>
    </>
  );
}
