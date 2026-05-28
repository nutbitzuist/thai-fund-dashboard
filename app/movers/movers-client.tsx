'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatPct, fundUrl, formatDateTh } from '@/lib/utils'
import { FUND_TYPE_LABELS } from '@/types'

interface MoverRow {
  rank: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType: string | null
  riskLevel: number | null
  amc: { nameTh: string } | null
  returnPct: number | null
  todayNav: number
  prevNav: number | null
}

interface MoversData {
  gainers: MoverRow[]
  losers: MoverRow[]
  date: string | null
  prevDate: string | null
  totalFunds: number
}

const TYPE_CHIPS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'EQ', label: 'หุ้นไทย' },
  { value: 'FIF', label: 'ต่างประเทศ' },
  { value: 'FI', label: 'ตราสารหนี้' },
  { value: 'BA', label: 'ผสม' },
  { value: 'MM', label: 'ตลาดเงิน' },
  { value: 'RMF', label: 'RMF' },
  { value: 'SSF', label: 'SSF' },
]

function MoverRow({ row, sign }: { row: MoverRow; sign: 'gain' | 'loss' }) {
  const isGain = sign === 'gain'
  return (
    <Link
      href={fundUrl(row)}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors group"
    >
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        isGain ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
      )}>
        {row.rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-blue-700">{row.projAbbrName ?? row.projId}</span>
          {row.fundType && (
            <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
              {FUND_TYPE_LABELS[row.fundType] ?? row.fundType}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-800 truncate mt-0.5 group-hover:text-blue-700">{row.nameTh}</p>
        <p className="text-xs text-slate-400">{row.amc?.nameTh}</p>
      </div>

      <div className="text-right shrink-0">
        <span className={cn(
          'text-base font-bold tabular-nums flex items-center gap-1',
          isGain ? 'text-emerald-600' : 'text-red-600'
        )}>
          {isGain ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {row.returnPct != null ? `${row.returnPct > 0 ? '+' : ''}${row.returnPct.toFixed(2)}%` : '-'}
        </span>
        <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{row.todayNav.toFixed(4)}</p>
      </div>
    </Link>
  )
}

export function MoversClient() {
  const [data, setData] = useState<MoversData | null>(null)
  const [fundType, setFundType] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (fundType) params.set('fundType', fundType)
      const res = await fetch(`/api/movers?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [fundType])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      {/* Type filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setFundType(chip.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              fundType === chip.value
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {data?.date && (
        <p className="text-xs text-slate-400">
          ข้อมูล NAV วันที่ {formatDateTh(data.date)} • เปรียบเทียบกับ {data.prevDate ? formatDateTh(data.prevDate) : 'วันก่อนหน้า'} • {data.totalFunds.toLocaleString('th-TH')} กองทุน
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white h-64 animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-slate-400 text-sm py-10 text-center">ไม่สามารถดึงข้อมูลได้</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Gainers */}
          <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border-b border-emerald-200">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <h2 className="font-semibold text-emerald-800 text-sm">ขึ้นมากสุดวันนี้</h2>
              <span className="ml-auto text-xs text-emerald-600">{data.gainers.length} กองทุน</span>
            </div>
            {data.gainers.length === 0 ? (
              <p className="text-slate-400 text-sm py-8 text-center">ไม่มีข้อมูล</p>
            ) : (
              data.gainers.map((row) => <MoverRow key={row.projId} row={row} sign="gain" />)
            )}
          </div>

          {/* Losers */}
          <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-200">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <h2 className="font-semibold text-red-800 text-sm">ลงมากสุดวันนี้</h2>
              <span className="ml-auto text-xs text-red-600">{data.losers.length} กองทุน</span>
            </div>
            {data.losers.length === 0 ? (
              <p className="text-slate-400 text-sm py-8 text-center">ไม่มีข้อมูล</p>
            ) : (
              data.losers.map((row) => <MoverRow key={row.projId} row={row} sign="loss" />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
