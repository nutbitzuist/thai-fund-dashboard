import type { Metadata } from 'next'
import { PiggyBank } from 'lucide-react'
import prisma from '@/lib/db'
import { DepositClient } from './deposit-client'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'กองทุน vs เงินฝาก — ฝากแบงก์หรือลงทุนดีกว่า?',
  description: 'เปรียบเทียบดอกเบี้ยเงินฝากธนาคารกับผลตอบแทนกองทุนตลาดเงินและตราสารหนี้ไทย ข้อมูลจริง ไม่ใช่การคาดเดา',
  keywords: ['กองทุน vs เงินฝาก', 'ดอกเบี้ยเงินฝาก', 'กองทุนตลาดเงิน', 'กองทุนตราสารหนี้', 'ฝากแบงก์'],
}

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
function toThaiDateShort(d: Date): string {
  return `${THAI_MONTH_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`
}

interface FundRow {
  projId: string
  projAbbrName: string | null
  nameTh: string
  returnPct: number | null
}

async function getTopFunds(): Promise<{ mm: FundRow[]; fi: FundRow[] }> {
  const query = async (type: string): Promise<FundRow[]> => {
    const metrics = await prisma.fundMetric.findMany({
      where: {
        period: '1Y',
        returnPct: { not: null },
        fundClass: { isDefault: true },
        fund: { fundStatus: { in: ['RG', 'SE'] }, fundType: type },
      },
      orderBy: { returnPct: 'desc' },
      take: 8,
      select: {
        returnPct: true,
        fund: { select: { projId: true, projAbbrName: true, nameTh: true } },
      },
    })
    return metrics.map((m) => ({
      projId: m.fund.projId,
      projAbbrName: m.fund.projAbbrName,
      nameTh: m.fund.nameTh,
      returnPct: m.returnPct != null ? Number(m.returnPct) : null,
    }))
  }

  try {
    const [mm, fi] = await Promise.all([query('MM'), query('FI')])
    return { mm, fi }
  } catch {
    return { mm: [], fi: [] }
  }
}

async function getBankRates() {
  const rows = await prisma.bankRate.findMany({ orderBy: [{ productType: 'asc' }, { ratePct: 'desc' }] })
  if (rows.length === 0) return null

  const verifiedAt = rows.reduce((latest, r) => r.verifiedAt > latest ? r.verifiedAt : latest, rows[0].verifiedAt)
  const savings = rows
    .filter((r) => r.productType === 'SDA')
    .map((r) => ({ bank: r.bankName, abbr: r.bankAbbr, rate: Number(r.ratePct) }))
  const fixed12m = rows
    .filter((r) => r.productType === 'FD12')
    .map((r) => ({ bank: r.bankName, abbr: r.bankAbbr, rate: Number(r.ratePct) }))

  return { updatedAt: toThaiDateShort(verifiedAt), savings, fixed12m }
}

// Fallback rates if DB is empty (should not happen after seed)
const FALLBACK_BANK_RATES = {
  updatedAt: 'พ.ค. 2568',
  savings: [
    { bank: 'กสิกรไทย', abbr: 'KBank', rate: 0.50 },
    { bank: 'ไทยพาณิชย์', abbr: 'SCB', rate: 0.50 },
    { bank: 'กรุงเทพ', abbr: 'BBL', rate: 0.50 },
    { bank: 'กรุงไทย', abbr: 'KTB', rate: 0.50 },
    { bank: 'ทหารไทยธนชาต', abbr: 'TTB', rate: 1.50 },
  ],
  fixed12m: [
    { bank: 'กสิกรไทย', abbr: 'KBank', rate: 1.50 },
    { bank: 'ไทยพาณิชย์', abbr: 'SCB', rate: 1.50 },
    { bank: 'กรุงเทพ', abbr: 'BBL', rate: 1.40 },
    { bank: 'กรุงไทย', abbr: 'KTB', rate: 1.50 },
    { bank: 'ทหารไทยธนชาต', abbr: 'TTB', rate: 1.85 },
  ],
}

export default async function DepositComparePage() {
  const [{ mm, fi }, bankRates] = await Promise.all([getTopFunds(), getBankRates()])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <PiggyBank className="h-5 w-5 text-blue-700" />
          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">เปรียบเทียบ</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">กองทุน vs เงินฝาก</h1>
        <p className="text-slate-500 text-sm mt-1">ฝากแบงก์หรือลงทุนกองทุนได้ผลตอบแทนดีกว่า?</p>
      </div>

      <DepositClient topMM={mm} topFI={fi} bankRates={bankRates ?? FALLBACK_BANK_RATES} />
    </div>
  )
}
