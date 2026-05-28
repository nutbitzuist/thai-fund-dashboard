// app/amcs/page.tsx — AMC Directory: All 29 Thai fund companies

import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, TrendingUp, ChevronRight } from 'lucide-react'
import prisma from '@/lib/db'
import { formatPct, getReturnColorClass, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'บริษัทจัดการกองทุน (บลจ.)',
  description: 'รายชื่อบริษัทจัดการกองทุนรวมไทยทั้งหมด พร้อมจำนวนกองทุนและผลตอบแทนเฉลี่ย',
}

export const revalidate = 3600 // revalidate hourly

interface AmcStats {
  id: number
  uniqueId: string
  nameTh: string
  nameEn: string | null
  fundCount: number
  avg1Y: number | null
}

async function getAmcStats(): Promise<AmcStats[]> {
  const amcs = await prisma.amc.findMany({
    orderBy: { nameTh: 'asc' },
    select: {
      id: true,
      uniqueId: true,
      nameTh: true,
      nameEn: true,
      funds: {
        where: { fundStatus: { in: ['RG', 'SE'] } },
        select: {
          id: true,
          fundMetrics: {
            where: { period: '1Y', fundClass: { isDefault: true }, returnPct: { not: null } },
            orderBy: { calculatedAt: 'desc' },
            take: 1,
            select: { returnPct: true },
          },
        },
      },
    },
  })

  return amcs.map((amc) => {
    const activeFunds = amc.funds
    const fundCount = activeFunds.length
    const returns = activeFunds
      .flatMap((f) => f.fundMetrics)
      .map((m) => Number(m.returnPct))
      .filter((v) => !isNaN(v))

    const avg1Y = returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : null

    return {
      id: amc.id,
      uniqueId: amc.uniqueId,
      nameTh: amc.nameTh,
      nameEn: amc.nameEn,
      fundCount,
      avg1Y,
    }
  }).filter((a) => a.fundCount > 0)
}

function shortAmcName(name: string): string {
  return name
    .replace('บริษัทหลักทรัพย์จัดการกองทุน', 'บลจ.')
    .replace(/จำกัด|\(มหาชน\)|บมจ\.|บจก\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default async function AmcsPage() {
  const amcs = await getAmcStats()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-blue-700" />
          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">บลจ. ไทยทั้งหมด</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">บริษัทจัดการกองทุน (บลจ.)</h1>
        <p className="text-slate-500 text-sm mt-1">
          {amcs.length} บลจ. — คลิกเพื่อดูกองทุนทั้งหมดของแต่ละบริษัท
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {amcs.map((amc) => (
          <Link
            key={amc.id}
            href={`/amcs/${encodeURIComponent(amc.uniqueId)}`}
            className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-4 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            {/* Icon placeholder */}
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                {shortAmcName(amc.nameTh)}
              </p>
              {amc.nameEn && (
                <p className="text-xs text-slate-400 truncate">{amc.nameEn}</p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">
                {amc.fundCount.toLocaleString('th-TH')} กองทุน
              </p>
            </div>

            <div className="text-right shrink-0 space-y-0.5">
              <p className="text-xs text-slate-400">ผลตอบแทนเฉลี่ย 1Y</p>
              <p className={cn('text-sm font-bold tabular-nums', getReturnColorClass(amc.avg1Y))}>
                {amc.avg1Y != null ? formatPct(amc.avg1Y) : '-'}
              </p>
            </div>

            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
