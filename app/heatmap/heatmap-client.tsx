'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cn, fundUrl } from '@/lib/utils'
import { FUND_TYPE_LABELS } from '@/types'

interface CategoryCell {
  type: string
  label: string
  fundCount: number
  withDataCount: number
  avgChange: number | null
  best: { projAbbrName: string; dailyChange: number } | null
  worst: { projAbbrName: string; dailyChange: number } | null
}

interface FundCell {
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType: string | null
  dailyChange: number | null
}

interface CategoryData {
  date: string
  prevDate: string
  categories: CategoryCell[]
}

interface FundData {
  type: string
  date: string
  prevDate: string
  funds: FundCell[]
}

// ±2% range for daily NAV changes
function interpolateColor(pct: number): string {
  const clamped = Math.max(-2, Math.min(2, pct))
  if (clamped >= 0) {
    const t = clamped / 2
    const r = Math.round(255 * (1 - t) + 22 * t)
    const g = Math.round(255 * (1 - t) + 163 * t)
    const b = Math.round(255 * (1 - t) + 74 * t)
    return `rgb(${r},${g},${b})`
  } else {
    const t = Math.abs(clamped) / 2
    const r = Math.round(255 * (1 - t) + 220 * t)
    const g = Math.round(255 * (1 - t) + 38 * t)
    const b = Math.round(255 * (1 - t) + 38 * t)
    return `rgb(${r},${g},${b})`
  }
}

function textColor(pct: number): string {
  return Math.abs(pct) > 0.8 ? 'text-white' : 'text-slate-800'
}

function formatChange(pct: number | null): string {
  if (pct === null) return 'N/A'
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'
}

function formatDateThai(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function HeatmapClient() {
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null)
  const [fundData, setFundData] = useState<FundData | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [loadingCategory, setLoadingCategory] = useState(true)
  const [loadingFunds, setLoadingFunds] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ fund: FundCell; x: number; y: number } | null>(null)

  useEffect(() => {
    fetch('/api/heatmap')
      .then((r) => r.json())
      .then((d: CategoryData) => setCategoryData(d))
      .catch(() => setError('ไม่สามารถโหลดข้อมูลได้'))
      .finally(() => setLoadingCategory(false))
  }, [])

  const handleSelectType = useCallback(async (type: string) => {
    setSelectedType(type)
    setFundData(null)
    setLoadingFunds(true)
    try {
      const res = await fetch(`/api/heatmap?type=${encodeURIComponent(type)}`)
      const d: FundData = await res.json()
      setFundData(d)
    } catch {
      // keep null
    } finally {
      setLoadingFunds(false)
    }
  }, [])

  const handleBack = () => {
    setSelectedType(null)
    setFundData(null)
  }

  if (loadingCategory) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-16 text-slate-400 text-sm">{error}</div>
  }

  if (!categoryData) return null

  const dateLabel = formatDateThai(categoryData.date)

  // Drill-down view
  if (selectedType !== null) {
    const typeLabel = FUND_TYPE_LABELS[selectedType] ?? selectedType
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับ
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{typeLabel}</h2>
            <p className="text-xs text-slate-400">ข้อมูล NAV วันที่ {dateLabel}</p>
          </div>
        </div>

        {loadingFunds ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : fundData ? (
          <div className="relative" onMouseLeave={() => setTooltip(null)}>
            <div className="flex flex-wrap gap-1.5">
              {fundData.funds.map((fund) => {
                const pct = fund.dailyChange
                const bg = pct !== null ? interpolateColor(pct) : '#F1F5F9'
                const tc = pct !== null ? textColor(pct) : 'text-slate-400'
                return (
                  <Link
                    key={fund.projId}
                    href={fundUrl(fund)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTooltip({ fund, x: rect.left + rect.width / 2, y: rect.bottom + 8 })
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg p-2 transition-transform hover:scale-105 hover:z-10 relative',
                      tc,
                    )}
                    style={{ backgroundColor: bg, minWidth: 70, minHeight: 56 }}
                  >
                    <span className="text-[10px] font-bold leading-tight text-center truncate w-full text-center px-0.5">
                      {fund.projAbbrName ?? fund.projId}
                    </span>
                    <span className="text-[10px] font-semibold mt-0.5">
                      {formatChange(pct)}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="fixed z-50 pointer-events-none rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2 text-xs min-w-[180px]"
                style={{ left: Math.min(tooltip.x - 90, window.innerWidth - 200), top: tooltip.y }}
              >
                <p className="font-bold text-blue-700 mb-0.5">{tooltip.fund.projAbbrName ?? tooltip.fund.projId}</p>
                <p className="text-slate-500 text-[11px] mb-1 truncate">{tooltip.fund.nameTh}</p>
                <p className={cn('font-semibold', tooltip.fund.dailyChange !== null && tooltip.fund.dailyChange >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {formatChange(tooltip.fund.dailyChange)}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Legend */}
        <div className="flex items-center gap-3 pt-2">
          <span className="text-xs text-slate-400">การเปลี่ยนแปลง:</span>
          {[-2, -1, 0, 1, 2].map((v) => (
            <div key={v} className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: interpolateColor(v) }} />
              <span className="text-xs text-slate-500">{v > 0 ? '+' : ''}{v}%</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-slate-100 border border-slate-200" />
            <span className="text-xs text-slate-400">ไม่มีข้อมูล</span>
          </div>
        </div>
      </div>
    )
  }

  // Category grid view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">ข้อมูล NAV วันที่ {dateLabel} · คลิกหมวดหมู่เพื่อดูกองทุนย่อย</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categoryData.categories.map((cat) => {
          const pct = cat.avgChange
          const bg = pct !== null ? interpolateColor(pct) : '#F8FAFC'
          const tc = pct !== null ? textColor(pct) : 'text-slate-500'
          return (
            <button
              key={cat.type}
              onClick={() => handleSelectType(cat.type)}
              className={cn(
                'rounded-2xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98] cursor-pointer',
                tc,
              )}
              style={{ backgroundColor: bg }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold opacity-80">{cat.type}</span>
                <span className="text-xs opacity-60">{cat.fundCount} กอง</span>
              </div>
              <p className="text-sm font-semibold leading-tight mb-2">{cat.label}</p>
              <p className="text-2xl font-bold tabular-nums">
                {pct !== null ? (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' : '—'}
              </p>
              {cat.best && (
                <p className="text-[10px] mt-2 opacity-75 truncate">
                  ↑ {cat.best.projAbbrName} {cat.best.dailyChange >= 0 ? '+' : ''}{cat.best.dailyChange.toFixed(2)}%
                </p>
              )}
              {cat.worst && cat.worst.projAbbrName !== cat.best?.projAbbrName && (
                <p className="text-[10px] opacity-60 truncate">
                  ↓ {cat.worst.projAbbrName} {cat.worst.dailyChange >= 0 ? '+' : ''}{cat.worst.dailyChange.toFixed(2)}%
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-400">ระดับสี:</span>
        {[-2, -1, -0.5, 0, 0.5, 1, 2].map((v) => (
          <div key={v} className="flex items-center gap-1">
            <div className="h-3 w-6 rounded-sm" style={{ backgroundColor: interpolateColor(v) }} />
            <span className="text-xs text-slate-500">{v > 0 ? '+' : ''}{v}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
