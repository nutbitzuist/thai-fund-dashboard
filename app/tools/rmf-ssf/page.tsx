import type { Metadata } from 'next'
import { Calculator } from 'lucide-react'
import prisma from '@/lib/db'
import { RmfSsfClient } from './rmf-ssf-client'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'คำนวณภาษี RMF/SSF 2568 — ลดหย่อนภาษีเงินได้บุคคลธรรมดา',
  description: 'คำนวณภาษีเงินได้บุคคลธรรมดาและประหยัดภาษีด้วย RMF และ SSF พร้อมดูกองทุน RMF/SSF ที่ผลตอบแทนดีที่สุดจากข้อมูลจริง',
  keywords: ['คำนวณภาษี RMF', 'ลดหย่อนภาษี SSF', 'ภาษีเงินได้บุคคลธรรมดา 2568', 'RMF SSF ดีที่สุด'],
}

interface FundRow {
  projId: string
  projAbbrName: string | null
  nameTh: string
  amc: { nameTh: string } | null
  returnPct: number | null
}

async function getTopFunds(): Promise<{ rmf: FundRow[]; ssf: FundRow[] }> {
  const query = async (type: string): Promise<FundRow[]> => {
    const metrics = await prisma.fundMetric.findMany({
      where: {
        period: '1Y',
        returnPct: { not: null },
        fundClass: { isDefault: true },
        fund: { fundStatus: { in: ['RG', 'SE'] }, fundType: type },
      },
      orderBy: { returnPct: 'desc' },
      take: 5,
      select: {
        returnPct: true,
        fund: {
          select: {
            projId: true,
            projAbbrName: true,
            nameTh: true,
            amc: { select: { nameTh: true } },
          },
        },
      },
    })
    return metrics.map((m) => ({
      projId: m.fund.projId,
      projAbbrName: m.fund.projAbbrName,
      nameTh: m.fund.nameTh,
      amc: m.fund.amc,
      returnPct: m.returnPct != null ? Number(m.returnPct) : null,
    }))
  }

  try {
    const [rmf, ssf] = await Promise.all([query('RMF'), query('SSF')])
    return { rmf, ssf }
  } catch {
    return { rmf: [], ssf: [] }
  }
}

export default async function RmfSsfPage() {
  const { rmf, ssf } = await getTopFunds()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="h-5 w-5 text-blue-700" />
          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">เครื่องมือภาษี</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">คำนวณภาษี RMF/SSF 2568</h1>
        <p className="text-slate-500 text-sm mt-1">
          ประหยัดภาษีเงินได้บุคคลธรรมดาด้วยกองทุน RMF และ SSF
        </p>
      </div>

      <RmfSsfClient topRmf={rmf} topSsf={ssf} />
    </div>
  )
}
