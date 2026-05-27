'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn, formatPct, getReturnColorClass } from '@/lib/utils'
import { RISK_LEVEL_LABELS } from '@/types'

interface FundResult {
  id: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  nameEn: string | null
  fundStatus: string | null
  fundType: string | null
  riskLevel: number | null
  amc: { nameTh: string } | null
}

interface FundSearchProps {
  placeholder?: string
  onSelect?: (fund: FundResult) => void
  className?: string
  autoFocus?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function FundSearch({
  placeholder = 'ค้นหากองทุน รหัส ชื่อไทย ชื่ออังกฤษ หรือ บลจ.',
  onSelect,
  className,
  autoFocus = false,
  size = 'md',
}: FundSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FundResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      setResults(data.results ?? [])
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setSelected(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 280)
  }

  const handleSelect = (fund: FundResult) => {
    setOpen(false)
    setQuery('')
    if (onSelect) {
      onSelect(fund)
    } else {
      router.push(`/funds/${fund.projId}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, -1))
    } else if (e.key === 'Enter' && selected >= 0) {
      handleSelect(results[selected])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-fund-search]')) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div data-fund-search className={cn('relative w-full', className)}>
      <div className="relative">
        <Search
          className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none',
            size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
          )}
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length && setOpen(true)}
          placeholder={placeholder}
          className={cn(
            'pl-9 pr-9',
            size === 'lg' && 'h-12 text-base pl-11 rounded-xl',
            size === 'sm' && 'h-8 text-xs pl-8'
          )}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
        ) : query ? (
          <button
            onClick={() => { setQuery(''); setOpen(false); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <ul>
            {results.map((fund, i) => (
              <li key={fund.projId}>
                <button
                  onClick={() => handleSelect(fund)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0',
                    selected === i && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-700 shrink-0">
                          {fund.projAbbrName ?? fund.projId}
                        </span>
                        {fund.riskLevel && (
                          <span className="text-xs text-slate-400">
                            ความเสี่ยง {fund.riskLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{fund.nameTh}</p>
                      {fund.amc && (
                        <p className="text-xs text-slate-400 truncate">{fund.amc.nameTh}</p>
                      )}
                    </div>
                    {fund.fundStatus && fund.fundStatus !== 'RDY' && (
                      <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 shrink-0">
                        {fund.fundStatus}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && !loading && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl px-4 py-3 text-sm text-slate-400">
          ไม่พบกองทุน "{query}"
        </div>
      )}
    </div>
  )
}
