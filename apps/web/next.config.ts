import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  const lowMemoryDev =
    phase === PHASE_DEVELOPMENT_SERVER && process.env.LOW_MEMORY_DEV === "1";

  return {
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
