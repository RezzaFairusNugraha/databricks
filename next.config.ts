import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isStandalone =
  process.env.DOCKER_BUILD === "1" ||
  process.env.STANDALONE === "true" ||
  process.platform !== "win32";

const nextConfig: NextConfig = {
  ...(isStandalone ? { output: "standalone" } : {}),
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false;
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
