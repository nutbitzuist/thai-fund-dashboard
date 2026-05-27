'use client'

import Link from 'next/link'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react'
import { cn, formatPct, formatNav, getReturnColorClass } from '@/lib/utils'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { Badge } from '@/components/ui/badge'
import { FUND_TYPE_LABELS } from '@/types'

interface FundRow {
  projId: string
  projAbbrName: string | null
  nameTh: string
  nameEn: string | null
  fundStatus: string | null
  fundType: string | null
  riskLevel: number | null
  amc: { nameTh: string } | null
  latestNav: number | null
  latestNavDate: string | null
  dailyChangePct: number | null
  return1Y: number | null
  return3Y: number | null
  volatility1Y: number | null
  maxDrawdown1Y: number | null
  sharpe1Y: number | null
}

type SortKey =
  | 'nameTh'
  | 'riskLevel'
  | 'return1Y'
  | 'return3Y'
  | 'volatility1Y'
  | 'maxDrawdown1Y'
  | 'sharpe1Y'
  | 'latestNav'

interface FundTableProps {
  funds: FundRow[]
  sortBy?: SortKey
  sortDir?: 'asc' | 'desc'
  onSort?: (key: SortKey) => void
  loading?: boolean
  showAmc?: boolean
  onAddCompare?: (fund: FundRow) => void
}

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  currentSort?: SortKey
  currentDir?: 'asc' | 'desc'
  onSort?: (key: SortKey) => void
  align?: 'left' | 'right'
}

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, align = 'right' }: SortHeaderProps) {
  const active = currentSort === sortKey
  return (
    <th
      className={cn(
        'px-3 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        onSort && 'cursor-pointer hover:text-slate-900 select-none'
      )}
      onClick={() => onSort?.(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

export function FundTable({
  funds,
  sortBy,
  sortDir,
  onSort,
  loading = false,
  showAmc = true,
  onAddCompare,
}: FundTableProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-48 bg-slate-200 animate-pulse rounded flex-1" />
              <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!funds.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
        <p className="text-slate-400 text-sm">ไม่พบกองทุนที่ตรงกับเงื่อนไข</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
      <table className="w-full min-w-[800px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-[200px]">
              กองทุน
            </th>
            {showAmc && (
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 hidden lg:table-cell">
                บลจ.
              </th>
            )}
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 hidden md:table-cell">
              ประเภท
            </th>
            <SortHeader label="ความเสี่ยง" sortKey="riskLevel" currentSort={sortBy} currentDir={sortDir} onSort={onSort} align="right" />
            <SortHeader label="NAV" sortKey="latestNav" currentSort={sortBy} currentDir={sortDir} onSort={onSort} align="right" />
            <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">
              วันนี้
            </th>
            <SortHeader label="1 ปี" sortKey="return1Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="3 ปี" sortKey="return3Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="Volatility" sortKey="volatility1Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <SortHeader label="Drawdown" sortKey="maxDrawdown1Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <th className="px-3 py-3 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {funds.map((fund) => (
            <tr
              key={fund.projId}
              className="hover:bg-slate-50 transition-colors group"
            >
              <td className="px-4 py-3">
                <Link href={`/funds/${fund.projId}`} className="block">
                  <span className="text-xs font-mono font-bold text-blue-700 block">
                    {fund.projAbbrName ?? fund.projId}
                  </span>
                  <span className="text-sm text-slate-900 line-clamp-1 mt-0.5">
                    {fund.nameTh}
                  </span>
                </Link>
              </td>
              {showAmc && (
                <td className="px-3 py-3 text-xs text-slate-500 hidden lg:table-cell max-w-[120px] truncate">
                  {fund.amc?.nameTh ?? '-'}
                </td>
              )}
              <td className="px-3 py-3 hidden md:table-cell">
                {fund.fundType ? (
                  <Badge variant="secondary" className="text-xs">
                    {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType}
                  </Badge>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-3 text-right">
                <RiskBadge riskLevel={fund.riskLevel} showLabel={false} />
              </td>
              <td className="px-3 py-3 text-right text-sm font-medium tabular-nums text-slate-900">
                {fund.latestNav != null ? formatNav(fund.latestNav) : '-'}
              </td>
              <td className={cn('px-3 py-3 text-right text-sm tabular-nums', getReturnColorClass(fund.dailyChangePct))}>
                {formatPct(fund.dailyChangePct)}
              </td>
              <td className={cn('px-3 py-3 text-right text-sm font-medium tabular-nums', getReturnColorClass(fund.return1Y))}>
                {formatPct(fund.return1Y)}
              </td>
              <td className={cn('px-3 py-3 text-right text-sm tabular-nums', getReturnColorClass(fund.return3Y))}>
                {formatPct(fund.return3Y)}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-600">
                {fund.volatility1Y != null ? `${fund.volatility1Y.toFixed(2)}%` : '-'}
              </td>
              <td className={cn(
                'px-3 py-3 text-right text-sm tabular-nums',
                fund.maxDrawdown1Y != null && fund.maxDrawdown1Y < -10 ? 'text-red-600' : 'text-slate-600'
              )}>
                {fund.maxDrawdown1Y != null ? `${fund.maxDrawdown1Y.toFixed(2)}%` : '-'}
              </td>
              <td className="px-3 py-3">
                <Link
                  href={`/funds/${fund.projId}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
