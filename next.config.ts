import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Large Gemini/OpenAI payloads during concept generation.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
