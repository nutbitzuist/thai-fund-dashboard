'use client'

// hooks/useWatchlist.ts
// localStorage-based watchlist for saving favourite funds — no auth required

import { useState, useEffect, useCallback } from 'react'

export interface WatchlistItem {
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType?: string | null
  addedAt: string // ISO timestamp
}

const STORAGE_KEY = 'thai-fund-watchlist'

function readStorage(): WatchlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WatchlistItem[]) : []
  } catch {
    return []
  }
}

function writeStorage(items: WatchlistItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Read from localStorage after hydration (avoids SSR mismatch)
  useEffect(() => {
    setItems(readStorage())
    setHydrated(true)
  }, [])

  const isWatched = useCallback(
    (projId: string) => items.some((i) => i.projId === projId),
    [items]
  )

  const add = useCallback((fund: Omit<WatchlistItem, 'addedAt'>) => {
    setItems((prev) => {
      if (prev.some((i) => i.projId === fund.projId)) return prev
      const next = [{ ...fund, addedAt: new Date().toISOString() }, ...prev]
      writeStorage(next)
      return next
    })
  }, [])

  const remove = useCallback((projId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.projId !== projId)
      writeStorage(next)
      return next
    })
  }, [])

  const toggle = useCallback(
    (fund: Omit<WatchlistItem, 'addedAt'>) => {
      if (isWatched(fund.projId)) {
        remove(fund.projId)
      } else {
        add(fund)
      }
    },
    [isWatched, add, remove]
  )

  return { items, isWatched, add, remove, toggle, hydrated }
}
