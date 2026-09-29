import type { NextConfig } from 'next';

// Read at build time and baked into the standalone server, so the Dockerfile takes it as a build arg.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // The browser only ever talks to this origin; auth cookies stay first-party.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
