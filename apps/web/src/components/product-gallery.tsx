"use client";

import { useState } from "react";
import type { ProductImage } from "@sjh/shared";

type ProductGalleryProps = {
  title: string;
  images: ProductImage[];
};

export function ProductGallery({ title, images }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className="product-detail-media">
        <div className="product-card-fallback" aria-hidden="true">
          SJH
        </div>
      </div>
    );
  }

  return (
    <div className="product-gallery">
      <div className="product-detail-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={active.altText ?? title} height={800} src={active.url} width={600} />
      </div>
      {images.length > 1 ? (
        <div className="product-gallery-thumbs" role="list">
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              aria-label={`View image ${index + 1}`}
              aria-pressed={index === activeIndex}
              className={`product-gallery-thumb${index === activeIndex ? " is-active" : ""}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" height={96} src={image.url} width={72} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
