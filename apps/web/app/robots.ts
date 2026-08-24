import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/supplier", "/supplier/", "/cart", "/checkout", "/orders", "/api/"]
    },
    sitemap: `${env.APP_URL}/sitemap.xml`
  };
}
