import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* duckdb bindings es un addon nativo (.node): NUNCA bundlear, solo externalizar */
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
