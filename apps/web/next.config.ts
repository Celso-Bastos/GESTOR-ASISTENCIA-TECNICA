import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const lowMemoryDev =
    phase === PHASE_DEVELOPMENT_SERVER && process.env.LOW_MEMORY_DEV === "1";

  return {
    async headers() {
      const headers = [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" }
      ];
      if (process.env.VERCEL_ENV === "production") {
        headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
      }
      return [{ source: "/:path*", headers }];
    },
    experimental: {
      serverActions: { bodySizeLimit: "5mb" },
      // Both flags are accepted by 16.2.9. Its memory flag is build-only and
      // preloading is production-server-only; neither reduces next dev memory.
      // Keep the profile isolated even if LOW_MEMORY_DEV reaches a build/start.
      ...(lowMemoryDev
        ? { webpackMemoryOptimizations: true, preloadEntriesOnStart: false }
        : {})
    },
    ...(lowMemoryDev
      ? {
          // App Router's Webpack entries also use this disposal mechanism.
          // Revisiting an inactive route can require compilation again.
          onDemandEntries: { maxInactiveAge: 25_000, pagesBufferLength: 2 }
        }
      : {})
  };
}
