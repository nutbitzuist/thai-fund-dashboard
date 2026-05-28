'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'
import { FundSearch } from '@/components/fund/fund-search'
import { cn, formatPct, fundUrl } from '@/lib/utils'
import { FUND_TYPE_LABELS } from '@/types'

interface TargetFund {
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType: string | null
  riskLevel: number | null
  return1Y: number | null
  amcName: string | null
}

interface Alternative {
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType: string | null
  riskLevel: number | null
  return1Y: number | null
  gainPct: number | null
  amcName: string | null
}

interface TwinResult {
  target: TargetFund
  alternatives: Alternative[]
}

function RiskBadge({ level }: { level: number | null }) {
  if (!level) return null
  const colors = ['', 'bg-emerald-100 text-emerald-700', 'bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-amber-100 text-amber-700', 'bg-red-100 text-red-700', 'bg-red-100 text-red-700']
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colors[level] ?? 'bg-slate-100 text-slate-600')}>
      ความเสี่ยง {level}
    </span>
  )
}

export function TwinClient() {
  const [result, setResult] = useState<TwinResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (fund: { projId: string; projAbbrName: string | null; nameTh: string }) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/twin?projId=${encodeURIComponent(fund.projId)}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'ไม่สามารถค้นหาได้')
      }
      const data: TwinResult = await res.json()
      setResult(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          ค้นหากองทุนที่คุณถืออยู่
        </label>
        <FundSearch
          placeholder="ค้นหาชื่อหรือรหัสกองทุน..."
          onSelect={handleSelect}
        />
        <p className="text-xs text-slate-400 mt-2">
          ระบบจะหากองทุนประเภทเดียวกัน ความเสี่ยงใกล้เคียง และผลตอบแทน 1 ปีดีกว่า
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && !loading && (
        <>
          {/* Target fund card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide font-semibold">กองทุนของคุณ</p>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono font-bold text-blue-700">{result.target.projAbbrName ?? result.target.projId}</span>
                  {result.target.fundType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                      {FUND_TYPE_LABELS[result.target.fundType] ?? result.target.fundType}
                    </span>
                  )}
                  <RiskBadge level={result.target.riskLevel} />
                </div>
                <p className="text-sm text-slate-600 mt-1 truncate">{result.target.nameTh}</p>
                {result.target.amcName && (
                  <p className="text-xs text-slate-400 mt-0.5">{result.target.amcName}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400 mb-0.5">ผลตอบแทน 1 ปี</p>
                <p className={cn('text-xl font-bold tabular-nums', result.target.return1Y != null
                  ? result.target.return1Y >= 0 ? 'text-emerald-600' : 'text-red-500'
                  : 'text-slate-400'
                )}>
                  {result.target.return1Y != null ? formatPct(result.target.return1Y) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Alternatives */}
          {result.alternatives.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-800 font-semibold text-base">ยินดีด้วย! กองทุนของคุณอยู่ในกลุ่มที่ดีที่สุดแล้ว</p>
              <p className="text-emerald-600 text-sm mt-1">
                ไม่พบกองทุนประเภทเดียวกัน ความเสี่ยงใกล้เคียง ที่ให้ผลตอบแทน 1 ปีดีกว่า
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                พบ {result.alternatives.length} กองทุนที่อาจดีกว่า
              </p>
              {result.alternatives.map((alt) => (
                <Link
                  key={alt.projId}
                  href={fundUrl(alt)}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold text-blue-700 group-hover:underline">
                          {alt.projAbbrName ?? alt.projId}
                        </span>
                        <RiskBadge level={alt.riskLevel} />
                        {alt.amcName && (
                          <span className="text-xs text-slate-400">{alt.amcName}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 truncate">{alt.nameTh}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className={cn('text-lg font-bold tabular-nums', alt.return1Y != null
                        ? alt.return1Y >= 0 ? 'text-emerald-600' : 'text-red-500'
                        : 'text-slate-400'
                      )}>
                        {alt.return1Y != null ? formatPct(alt.return1Y) : '—'}
                      </p>
                      {alt.gainPct != null && (
                        <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          +{alt.gainPct.toFixed(2)}% กว่ากองทุนคุณ
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <TrendingUp className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">ค้นหากองทุนที่คุณถืออยู่เพื่อเริ่มต้น</p>
          <p className="text-slate-400 text-xs mt-1">เราจะหากองทุนฝาแฝดที่ให้ผลตอบแทนดีกว่า</p>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        ผลตอบแทนในอดีตไม่รับประกันอนาคต ข้อมูลนี้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  )
}
