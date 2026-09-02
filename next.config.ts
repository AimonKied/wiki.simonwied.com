import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // Keep Turbopack scoped to this repository.
  },
};

export default nextConfig;
