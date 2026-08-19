import type { Metadata } from "next";
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
