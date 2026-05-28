// Shared cache header helpers for Vercel/Next route handlers.
// Fund data is updated by the daily sync, not tick-by-tick, so read APIs can be
// cached aggressively at Vercel's edge to avoid repeated origin/function work.

export const CACHE_PROFILES = {
  // Default public fund data: keep fresh enough for users, but absorb traffic.
  fundData: {
    browserMaxAge: 60,
    cdnMaxAge: 60 * 60 * 6, // 6 hours
    staleWhileRevalidate: 60 * 60 * 24, // 24 hours
  },
  // Search is more query-shaped; cache briefly to protect origin from repeated
  // keystroke/search traffic without making new funds feel stale for long.
  search: {
    browserMaxAge: 30,
    cdnMaxAge: 60 * 10, // 10 minutes
    staleWhileRevalidate: 60 * 60, // 1 hour
  },
} as const;

type CacheProfile = (typeof CACHE_PROFILES)[keyof typeof CACHE_PROFILES];

export function publicCacheHeaders(profile: CacheProfile = CACHE_PROFILES.fundData): HeadersInit {
  const browser = `public, max-age=${profile.browserMaxAge}, stale-while-revalidate=${profile.staleWhileRevalidate}`;
  const cdn = `public, max-age=${profile.cdnMaxAge}, stale-while-revalidate=${profile.staleWhileRevalidate}`;

  return {
    // Browser/proxy visible cache policy.
    'Cache-Control': browser,
    // Vercel-specific edge cache policy. These are consumed by Vercel and reduce
    // origin/function transfer even when browsers re-check frequently.
    'CDN-Cache-Control': cdn,
    'Vercel-CDN-Cache-Control': cdn,
  };
}
