import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Provide safe dev defaults for public envs to avoid undefined API base
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none';", // modern alternative
          },
        ],
      },
    ];
  },
};

export default nextConfig;
