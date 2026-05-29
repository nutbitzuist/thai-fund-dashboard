// app/sitemap.ts — Dynamic sitemap covering all indexable pages
import type { MetadataRoute } from 'next';
import prisma from '@/lib/db';

export const revalidate = 86400; // 24h

const FUND_TYPES = ['EQ', 'FI', 'MM', 'BA', 'RE', 'CM', 'AI', 'FIF', 'SSF', 'RMF'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://funds.bulltiq.com';
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base,                              lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/funds`,                   lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/rankings`,                lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/movers`,                  lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/heatmap`,                 lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/screener`,                lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/compare`,                 lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/amcs`,                    lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/tools/deposit-compare`,   lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/tools/twin`,              lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/watchlist`,               lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/learn`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/methodology`,             lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const typePages: MetadataRoute.Sitemap = FUND_TYPES.map((type) => ({
    url: `${base}/funds/type/${type}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  try {
    const [funds, amcs] = await Promise.all([
      prisma.fund.findMany({
        where: { fundStatus: { in: ['RG', 'SE'] } },
        select: { projAbbrName: true, projId: true },
      }),
      prisma.amc.findMany({ select: { uniqueId: true, slug: true } }),
    ]);

    const fundPages: MetadataRoute.Sitemap = funds.map((f) => ({
      url: `${base}/funds/${encodeURIComponent(f.projAbbrName ?? f.projId)}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    const amcPages: MetadataRoute.Sitemap = amcs.map((a) => ({
      url: `${base}/amcs/${a.slug ?? encodeURIComponent(a.uniqueId)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...staticPages, ...typePages, ...fundPages, ...amcPages];
  } catch {
    return [...staticPages, ...typePages];
  }
}
