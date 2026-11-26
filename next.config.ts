import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Preserve old Shopify links whose content exists on the current storefront.
    // Retired tags, feeds and hidden products keep their genuine 404 responses.
    return [
      {
        source: "/collections/:collection/products/:handle",
        destination: "https://www.vineyardsun.com/products/:handle",
        permanent: true,
      },
      { source: "/collections/all", destination: "https://www.vineyardsun.com/#catalog", permanent: true },
      { source: "/pages/about-us", destination: "https://www.vineyardsun.com/#about", permanent: true },
      { source: "/pages/partners", destination: "https://www.vineyardsun.com/#partners", permanent: true },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
