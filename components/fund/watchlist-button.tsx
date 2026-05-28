'use client'

// components/fund/watchlist-button.tsx
// Heart button that adds/removes a fund from the local watchlist

import { Heart } from 'lucide-react'
import { useWatchlist, type WatchlistItem } from '@/hooks/useWatchlist'
import { cn } from '@/lib/utils'

interface WatchlistButtonProps {
  fund: Omit<WatchlistItem, 'addedAt'>
  size?: 'sm' | 'md'
  className?: string
}

export function WatchlistButton({ fund, size = 'md', className }: WatchlistButtonProps) {
  const { isWatched, toggle, hydrated } = useWatchlist()

  if (!hydrated) return null // avoid SSR mismatch

  const watched = isWatched(fund.projId)

  return (
    <button
      onClick={() => toggle(fund)}
      title={watched ? 'นำออกจากรายการติดตาม' : 'เพิ่มในรายการติดตาม'}
      aria-label={watched ? 'นำออกจากรายการติดตาม' : 'เพิ่มในรายการติดตาม'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border transition-colors',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        watched
          ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
          : 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:text-red-500',
        className
      )}
    >
      <Heart className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', watched && 'fill-current')} />
      {size === 'md' && (watched ? 'ติดตามอยู่' : 'ติดตาม')}
    </button>
  )
}
