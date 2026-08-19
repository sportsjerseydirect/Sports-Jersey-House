import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["@sjh/shared", "@sjh/search", "@sjh/ai"]
  }
};

export default nextConfig;
