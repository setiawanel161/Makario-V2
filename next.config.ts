import type { NextConfig } from 'next';

const playwrightOrigins =
  process.env.PLAYWRIGHT_E2E === 'true'
    ? ['localhost:3000', '127.0.0.1:3000']
    : undefined;

const nextConfig: NextConfig = {
  output: 'standalone',
  ...(playwrightOrigins
    ? { experimental: { serverActions: { allowedOrigins: playwrightOrigins } } }
    : {}),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
