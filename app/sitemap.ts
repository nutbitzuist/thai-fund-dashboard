// app/sitemap.ts — Dynamic sitemap covering all indexable pages
import type { MetadataRoute } from 'next';
import prisma from '@/lib/db';
import { appBaseUrl } from '@/lib/utils';
import { SEO_LANDING_PAGES } from '@/lib/bulltiq-content';

export const revalidate = 86400; // 24h

const FUND_TYPES = ['EQ', 'FI', 'MM', 'BA', 'RE', 'CM', 'AI', 'FIF', 'SSF', 'RMF'];

function seoMetricField(metric: string) {
  if (metric === 'volatility1Y') return 'annualizedVolatilityPct';
  if (metric === 'maxDrawdown1Y') return 'maxDrawdownPct';
  if (metric === 'sharpe1Y') return 'sharpeRatio';
  return 'returnPct';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appBaseUrl();
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
    { url: `${base}/insights`,                lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
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

  const fallbackInsightPages: MetadataRoute.Sitemap = SEO_LANDING_PAGES.map((page) => ({
    url: `${base}/insights/${page.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.85,
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

    const indexableInsightPages = await Promise.all(SEO_LANDING_PAGES.map(async (page) => {
      const field = seoMetricField(page.metric);
      const count = await prisma.fundMetric.count({
        where: {
          period: '1Y',
          [field]: { not: null },
          navCount: { gte: 230 },
          fundClass: { isDefault: true },
          fund: {
            fundStatus: { in: ['RG', 'SE'] },
            ...(page.fundType ? { fundType: page.fundType } : {}),
            ...(page.amcQuery ? {
              amc: {
                OR: [
                  { nameTh: { contains: page.amcQuery, mode: 'insensitive' as const } },
                  { nameEn: { contains: page.amcQuery, mode: 'insensitive' as const } },
                  { slug: { contains: page.amcQuery.toLowerCase(), mode: 'insensitive' as const } },
                ],
              },
            } : {}),
          },
        },
      });
      return count >= page.qualityGate.minRows ? page : null;
    }));

    const insightPages: MetadataRoute.Sitemap = indexableInsightPages
      .filter((page): page is NonNullable<typeof page> => page !== null)
      .map((page) => ({
        url: `${base}/insights/${page.slug}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.85,
      }));

    const amcPages: MetadataRoute.Sitemap = amcs.map((a) => ({
      url: `${base}/amcs/${a.slug ?? encodeURIComponent(a.uniqueId)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...staticPages, ...typePages, ...insightPages, ...fundPages, ...amcPages];
  } catch {
    return [...staticPages, ...typePages, ...fallbackInsightPages];
  }
}
