import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@sjh/shared", "@sjh/search", "@sjh/database", "@sjh/ai"],
  experimental: {
    // Keep @sjh/search un-optimized so league collection constants bundle into server code.
    optimizePackageImports: ["@sjh/shared", "@sjh/ai"]
  },
  async redirects() {
    return [
      {
        source: "/admin/tracking-exceptions",
        destination: "/admin/tracking/exceptions",
        permanent: false
      },
      {
        source: "/admin/ops-jobs",
        destination: "/admin/jobs",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
