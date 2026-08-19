import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // The dev server answers 403 to its own chunks when the page is opened from a host
  // it does not recognise, and the offline runbook points everything at 127.0.0.1. The
  // symptom is nasty: HTML renders, no client bundle loads, so the page sits on
  // "Reading the chain…" forever with nothing in the terminal.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
