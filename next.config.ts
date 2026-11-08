import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "discern.seanreid.workers.dev" }],
        destination: "https://discern.dwainosaur.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
