import { RISK_LEVEL_LABELS } from '@/types'
import { cn } from '@/lib/utils'

interface RiskBadgeProps {
  riskLevel: number | null | undefined
  className?: string
  showLabel?: boolean
}

const riskColors: Record<number, string> = {
  1: 'bg-green-100 text-green-800 border-green-200',
  2: 'bg-green-100 text-green-800 border-green-200',
  3: 'bg-lime-100 text-lime-800 border-lime-200',
  4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  5: 'bg-orange-100 text-orange-800 border-orange-200',
  6: 'bg-red-100 text-red-800 border-red-200',
  7: 'bg-red-100 text-red-800 border-red-200',
  8: 'bg-red-200 text-red-900 border-red-300',
}

export function RiskBadge({ riskLevel, className, showLabel = true }: RiskBadgeProps) {
  if (riskLevel == null) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-slate-100 text-slate-500 border-slate-200', className)}>
        ไม่ระบุ
      </span>
    )
  }

  const colorClass = riskColors[riskLevel] ?? riskColors[8]
  const label = RISK_LEVEL_LABELS[riskLevel] ?? `ระดับ ${riskLevel}`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        colorClass,
        className
      )}
    >
      <span className="font-bold">{riskLevel}</span>
      {showLabel && <span>{label}</span>}
    </span>
  )
}
