import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

if (apiProxyTarget) {
  console.info(
    `[next.config] Proxying studio /api/* → ${apiProxyTarget}/api/* (auth stays local for magic-link cookies)`,
  );
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
    // Auth must stay on the same origin as the browser (PKCE cookies + /auth/callback).
    // Studio generation/history still hit Railway.
    return {
      beforeFiles: [
        {
          source: "/api/project-list",
          destination: `${apiProxyTarget}/api/project-list`,
        },
        {
          source: "/api/generate-concepts",
          destination: `${apiProxyTarget}/api/generate-concepts`,
        },
        {
          source: "/api/projects",
          destination: `${apiProxyTarget}/api/projects`,
        },
        {
          source: "/api/projects/:path*",
          destination: `${apiProxyTarget}/api/projects/:path*`,
        },
        {
          source: "/api/images/:path*",
          destination: `${apiProxyTarget}/api/images/:path*`,
        },
        {
          source: "/api/assets/:path*",
          destination: `${apiProxyTarget}/api/assets/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
