import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/products"];

  return routes.map((route) => ({
    url: new URL(route, env.APP_URL).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.8
  }));
}
