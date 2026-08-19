import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@sjh/shared", "@sjh/search", "@sjh/database", "@sjh/ai"],
  experimental: {
    optimizePackageImports: ["@sjh/shared", "@sjh/search", "@sjh/ai"]
  }
};

export default nextConfig;
