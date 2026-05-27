import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow images from SEC API domain
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.sec.or.th' },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  // Redirect www to non-www
  async redirects() {
    return []
  },

  // Experimental: server components external packages
  serverExternalPackages: ['@prisma/client', 'prisma'],
}

export default nextConfig
