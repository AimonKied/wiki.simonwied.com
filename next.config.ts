import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // scope Turbopack to wiki-v2, not the user home dir
  },
};

export default nextConfig;
