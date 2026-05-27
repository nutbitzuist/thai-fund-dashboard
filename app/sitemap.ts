// app/sitemap.ts
// Dynamic sitemap — generates one entry per active fund page.
// Revalidated every 24h (ISR). SEC updates fund list daily.
import type { MetadataRoute } from 'next';
import prisma from '@/lib/db';

export const revalidate = 86400; // 24h

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thai-fund-dashboard.vercel.app';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/funds`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/compare`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
  ];

  // Dynamic fund pages
  try {
    const funds = await prisma.fund.findMany({
      where: { fundStatus: { in: ['RG', 'SE'] } },
      select: { projId: true },
    });

    const fundPages: MetadataRoute.Sitemap = funds.map((f) => ({
      url: `${baseUrl}/funds/${encodeURIComponent(f.projId)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    return [...staticPages, ...fundPages];
  } catch {
    // If DB is unavailable, return static pages only
    return staticPages;
  }
}
