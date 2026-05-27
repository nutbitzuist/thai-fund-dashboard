'use client'

import { HelpCircle } from 'lucide-react'
import { cn, formatPct, formatNumber, getReturnColorClass } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

interface MetricCardProps {
  label: string
  value: number | null | undefined
  type?: 'percent' | 'number' | 'ratio'
  description?: string
  positive?: 'up' | 'down' // which direction is "positive"
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MetricCard({
  label,
  value,
  type = 'percent',
  description,
  positive = 'up',
  className,
  size = 'md',
}: MetricCardProps) {
  const formatted =
    type === 'percent'
      ? formatPct(value)
      : type === 'ratio'
      ? value != null
        ? value.toFixed(2)
        : '-'
      : formatNumber(value)

  // Determine color based on positive direction
  let colorClass = 'text-slate-400'
  if (value != null && !isNaN(value)) {
    if (positive === 'up') {
      colorClass = getReturnColorClass(value)
    } else {
      // For metrics where lower = better (volatility, drawdown)
      colorClass = value < 0 ? 'text-red-600' : value > 0 ? 'text-slate-600' : 'text-green-600'
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-1',
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'font-medium text-slate-500',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}
        >
          {label}
        </span>
        {description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-slate-300 cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs leading-relaxed">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span
        className={cn(
          'font-bold tabular-nums',
          colorClass,
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-2xl',
          size === 'lg' && 'text-3xl'
        )}
      >
        {formatted}
      </span>
    </div>
  )
}

interface PeriodMetricRowProps {
  period: string
  periodLabel: string
  returnPct: number | null | undefined
  volatility?: number | null
  maxDrawdown?: number | null
  sharpe?: number | null
  compact?: boolean
}

export function PeriodMetricRow({
  period,
  periodLabel,
  returnPct,
  volatility,
  maxDrawdown,
  sharpe,
  compact = false,
}: PeriodMetricRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-slate-600">{periodLabel}</td>
      <td className={cn('py-3 text-sm font-semibold tabular-nums', getReturnColorClass(returnPct))}>
        {formatPct(returnPct)}
      </td>
      {!compact && (
        <>
          <td className="py-3 text-sm tabular-nums text-slate-600">
            {volatility != null ? `${volatility.toFixed(2)}%` : '-'}
          </td>
          <td className={cn('py-3 text-sm tabular-nums', maxDrawdown != null && maxDrawdown < -5 ? 'text-red-600' : 'text-slate-600')}>
            {maxDrawdown != null ? `${maxDrawdown.toFixed(2)}%` : '-'}
          </td>
          <td className="py-3 text-sm tabular-nums text-slate-600">
            {sharpe != null ? sharpe.toFixed(2) : '-'}
          </td>
        </>
      )}
    </tr>
  )
}
