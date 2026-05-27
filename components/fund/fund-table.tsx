'use client'

import Link from 'next/link'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react'
import { cn, formatPct, formatNav, getReturnColorClass, fundUrl } from '@/lib/utils'
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
  | 'amc'
  | 'fundType'

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
  className?: string
}

function SortHeader({ label, sortKey, currentSort, currentDir, onSort, align = 'right', className }: SortHeaderProps) {
  const active = currentSort === sortKey
  return (
    <th
      className={cn(
        'px-3 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        onSort && 'cursor-pointer hover:text-slate-900 select-none',
        className,
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

// ── Skeleton ─────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      {/* Mobile skeleton */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-4 flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 bg-slate-200 animate-pulse rounded" />
              <div className="h-4 w-48 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="h-5 w-16 bg-slate-200 animate-pulse rounded" />
          </div>
        ))}
      </div>
      {/* Desktop skeleton */}
      <div className="hidden sm:block divide-y divide-slate-100">
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

// ── Mobile Card Row ───────────────────────────────────────────────────────────
function MobileFundCard({ fund }: { fund: FundRow }) {
  return (
    <Link href={fundUrl(fund)} className="block px-4 py-3.5 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-mono font-bold text-blue-700">
              {fund.projAbbrName ?? fund.projId}
            </span>
            {fund.riskLevel && (
              <RiskBadge riskLevel={fund.riskLevel} showLabel={false} />
            )}
            {fund.fundType && (
              <Badge variant="secondary" className="text-xs hidden xs:inline-flex">
                {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-900 line-clamp-1">{fund.nameTh}</p>
          {fund.amc && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{fund.amc.nameTh}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {/* 1Y return is the hero metric on mobile */}
          <p className={cn('text-sm font-bold tabular-nums', getReturnColorClass(fund.return1Y))}>
            {formatPct(fund.return1Y)}
          </p>
          <p className="text-xs text-slate-400">1 ปี</p>
          {fund.latestNav != null && (
            <p className="text-xs text-slate-500 tabular-nums mt-1">
              {formatNav(fund.latestNav)}
            </p>
          )}
        </div>
      </div>
      {/* Mini stats row */}
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
        {fund.dailyChangePct != null && (
          <span className={cn('tabular-nums', getReturnColorClass(fund.dailyChangePct))}>
            วันนี้ {formatPct(fund.dailyChangePct)}
          </span>
        )}
        {fund.return3Y != null && (
          <span className={cn('tabular-nums', getReturnColorClass(fund.return3Y))}>
            3ปี {formatPct(fund.return3Y)}
          </span>
        )}
        {fund.volatility1Y != null && (
          <span className="text-slate-400">Vol {fund.volatility1Y.toFixed(1)}%</span>
        )}
      </div>
    </Link>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function FundTable({
  funds,
  sortBy,
  sortDir,
  onSort,
  loading = false,
  showAmc = true,
  onAddCompare,
}: FundTableProps) {
  if (loading) return <LoadingSkeleton />

  if (!funds.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
        <p className="text-slate-400 text-sm">ไม่พบกองทุนที่ตรงกับเงื่อนไข</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* ── Mobile: card list (hidden on sm+) ─── */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {funds.map((fund) => (
          <MobileFundCard key={fund.projId} fund={fund} />
        ))}
      </div>

      {/* ── Desktop: scrollable table (hidden below sm) ─── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <SortHeader
                label="กองทุน"
                sortKey="nameTh"
                currentSort={sortBy}
                currentDir={sortDir}
                onSort={onSort}
                align="left"
                className="w-[220px]"
              />
              {showAmc && (
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 hidden xl:table-cell">
                  บลจ.
                </th>
              )}
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 hidden lg:table-cell">
                ประเภท
              </th>
              <SortHeader label="ความเสี่ยง" sortKey="riskLevel" currentSort={sortBy} currentDir={sortDir} onSort={onSort} align="right" />
              <SortHeader label="NAV" sortKey="latestNav" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">
                วันนี้
              </th>
              <SortHeader label="1 ปี" sortKey="return1Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
              <SortHeader label="3 ปี" sortKey="return3Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
              <SortHeader label="Volatility" sortKey="volatility1Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} className="hidden lg:table-cell" />
              <SortHeader label="Drawdown" sortKey="maxDrawdown1Y" currentSort={sortBy} currentDir={sortDir} onSort={onSort} className="hidden lg:table-cell" />
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
                  <Link href={fundUrl(fund)} className="block">
                    <span className="text-xs font-mono font-bold text-blue-700 block">
                      {fund.projAbbrName ?? fund.projId}
                    </span>
                    <span className="text-sm text-slate-900 line-clamp-1 mt-0.5">
                      {fund.nameTh}
                    </span>
                  </Link>
                </td>
                {showAmc && (
                  <td className="px-3 py-3 text-xs text-slate-500 hidden xl:table-cell max-w-[120px] truncate">
                    {fund.amc?.nameTh ?? '-'}
                  </td>
                )}
                <td className="px-3 py-3 hidden lg:table-cell">
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
                <td className={cn('px-3 py-3 text-right text-sm tabular-nums hidden md:table-cell', getReturnColorClass(fund.return3Y))}>
                  {formatPct(fund.return3Y)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-600 hidden lg:table-cell">
                  {fund.volatility1Y != null ? `${fund.volatility1Y.toFixed(2)}%` : '-'}
                </td>
                <td className={cn(
                  'px-3 py-3 text-right text-sm tabular-nums hidden lg:table-cell',
                  fund.maxDrawdown1Y != null && fund.maxDrawdown1Y < -10 ? 'text-red-600' : 'text-slate-600'
                )}>
                  {fund.maxDrawdown1Y != null ? `${fund.maxDrawdown1Y.toFixed(2)}%` : '-'}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={fundUrl(fund)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 block"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
