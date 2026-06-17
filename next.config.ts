import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions / route handlers receive base64 + multipart image uploads.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
