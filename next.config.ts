import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

if (apiProxyTarget) {
  console.info(`[next.config] Proxying /api/* → ${apiProxyTarget}/api/*`);
}

const nextConfig: NextConfig = {
  // Large Gemini/OpenAI payloads during concept generation.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
    // External /api rewrites default to 30s; concept generate/refine often need 1–4 min.
    proxyTimeout: 300_000,
  },
  async rewrites() {
    if (!apiProxyTarget) return [];
    // beforeFiles: otherwise local app/api route handlers win and Railway is never hit.
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${apiProxyTarget}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
