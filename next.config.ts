import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/tahseel-app',
  assetPrefix: '/tahseel-app/',
  images: {
    unoptimized: true,
  }
};

export default nextConfig;
