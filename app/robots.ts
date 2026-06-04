// app/robots.ts
import type { MetadataRoute } from 'next'
import { appBaseUrl } from '@/lib/utils'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = appBaseUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: ['/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
