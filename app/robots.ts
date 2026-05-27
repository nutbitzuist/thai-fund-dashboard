// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thai-fund-dashboard.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/funds/', '/funds/*', '/compare'],
        disallow: ['/api/', '/api/sync/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
