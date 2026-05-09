import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// ─── HTTP Security Headers ─────────────────────────────────────────────────────
// Applied to every route via the headers() function below.
// CSP uses unsafe-inline/unsafe-eval because Next.js 15 App Router requires
// them for inline script hydration — tighten with nonces in a future pass.
//
// connect-src is environment-aware:
//   dev  → allows http://localhost:* for the local Express API (port 3001)
//          and Next.js HMR websocket (port 3000)
//   prod → https: only
const connectSrc = isDev
  ? "connect-src 'self' http://localhost:* ws://localhost:* https:"
  : "connect-src 'self' https:";

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block page from being framed (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Enable browser XSS filter (legacy browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Only send origin on cross-origin requests, full URL on same-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Force HTTPS for 2 years — skip in dev (page is served over HTTP locally)
  ...(!isDev
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,

  async headers() {
    return [
      {
        // Apply security headers to every route
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Dashboard routes must never be served from browser cache.
        // Without this, pressing "back" after sign-out shows a stale cached
        // page, making the dashboard appear accessible when it isn't.
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
        pathname: "/maps/api/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
