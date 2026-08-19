import type { Metadata } from "next";
import type { ProductDetail } from "@sjh/shared";
import { env } from "./env";

type SeoInput = {
  title: string;
  description: string;
  path?: string;
};

export function createMetadata({ title, description, path = "/" }: SeoInput): Metadata {
  const canonical = new URL(path, env.APP_URL).toString();

  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: env.APP_NAME,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: env.APP_NAME,
    url: env.APP_URL
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: env.APP_NAME,
    url: env.APP_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${env.APP_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, env.APP_URL).toString()
    }))
  };
}

export function productJsonLd(product: ProductDetail) {
  const productUrl = new URL(`/products/${product.slug}`, env.APP_URL).toString();
  const primaryVariant = product.variants.find((variant) => variant.isAvailable) ?? product.variants[0];

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    url: productUrl,
    image: product.images.map((image) => image.url),
    brand: product.vendor
      ? {
          "@type": "Brand",
          name: product.vendor
        }
      : undefined,
    offers: primaryVariant
      ? {
          "@type": "Offer",
          price: primaryVariant.price.amount,
          priceCurrency: primaryVariant.price.currencyCode,
          availability: primaryVariant.isAvailable
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: productUrl
        }
      : undefined
  };
}
