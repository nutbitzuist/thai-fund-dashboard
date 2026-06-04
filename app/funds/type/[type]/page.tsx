// app/funds/type/[type]/page.tsx
// Dedicated pages for fund types — especially SSF and RMF (tax-privileged funds)

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Shield, PiggyBank } from 'lucide-react'
import { FUND_TYPE_LABELS } from '@/types'
import { TypeFundBrowser } from './type-fund-browser'

interface Props {
  params: Promise<{ type: string }>
}

// Valid fund types
const VALID_TYPES = ['EQ', 'FI', 'MM', 'BA', 'RE', 'CM', 'AI', 'FIF', 'SSF', 'RMF']

// Rich descriptions per type
const TYPE_META: Record<string, { title: string; description: string; icon?: string; taxBenefit?: string }> = {
  SSF: {
    title: 'กองทุน SSF (Super Saving Fund)',
    description: 'กองทุนรวมเพื่อการออมสำหรับลดหย่อนภาษี ลงทุนได้สูงสุด 30% ของรายได้ แต่ไม่เกิน 200,000 บาทต่อปี ต้องถือ 10 ปีขึ้นไปนับจากวันซื้อ',
    taxBenefit: 'ลดหย่อนภาษีได้สูงสุด 200,000 บาท/ปี (30% ของรายได้)',
  },
  RMF: {
    title: 'กองทุน RMF (Retirement Mutual Fund)',
    description: 'กองทุนรวมเพื่อการเลี้ยงชีพ ออกแบบมาเพื่อออมเงินระยะยาวไปจนถึงเกษียณ ลดหย่อนภาษีได้ตามเกณฑ์ที่กำหนด ต้องถือจนอายุ 55 ปีขึ้นไป',
    taxBenefit: 'ลดหย่อนภาษีได้สูงสุด 500,000 บาท/ปี (รวมกับ SSF ไม่เกิน 500,000)',
  },
  EQ: {
    title: 'กองทุนหุ้น (Equity Fund)',
    description: 'กองทุนที่ลงทุนในหุ้นไทยเป็นหลัก มีความเสี่ยงสูงกว่า แต่มีโอกาสให้ผลตอบแทนสูงในระยะยาว เหมาะสำหรับนักลงทุนที่รับความเสี่ยงได้',
  },
  FIF: {
    title: 'กองทุนต่างประเทศ (Foreign Investment Fund)',
    description: 'กองทุนที่ลงทุนในหลักทรัพย์ต่างประเทศ ได้รับผลตอบแทนจากตลาดโลก มีความเสี่ยงด้านอัตราแลกเปลี่ยนเพิ่มเติม',
  },
  FI: {
    title: 'กองทุนตราสารหนี้ (Fixed Income Fund)',
    description: 'กองทุนที่ลงทุนในพันธบัตรรัฐบาล หุ้นกู้ และตราสารหนี้ต่างๆ มีความเสี่ยงต่ำกว่าหุ้น ให้ผลตอบแทนสม่ำเสมอ',
  },
  MM: {
    title: 'กองทุนตลาดเงิน (Money Market Fund)',
    description: 'กองทุนความเสี่ยงต่ำที่สุด ลงทุนในเงินฝาก ตั๋วเงินคลัง และตราสารหนี้ระยะสั้น เหมาะสำหรับเก็บเงินสดชั่วคราว',
  },
  BA: {
    title: 'กองทุนผสม (Balanced Fund)',
    description: 'กองทุนที่ลงทุนทั้งในหุ้นและตราสารหนี้ ปรับสัดส่วนตามนโยบายของกองทุน ความเสี่ยงอยู่ระดับกลาง',
  },
  RE: {
    title: 'กองทุนอสังหาริมทรัพย์และ REIT',
    description: 'กองทุนที่ลงทุนในอสังหาริมทรัพย์หรือกองทรัสต์เพื่อการลงทุนในอสังหาริมทรัพย์ (REIT) มักให้เงินปันผลสม่ำเสมอ',
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params
  const upper = type.toUpperCase()
  if (!VALID_TYPES.includes(upper)) return { title: 'ไม่พบประเภทกองทุน' }
  const meta = TYPE_META[upper]
  const label = FUND_TYPE_LABELS[upper] ?? upper
  return {
    title: meta?.title ?? `กองทุน${label}`,
    description: meta?.description ?? `กองทุนรวมไทยประเภท${label}`,
  }
}

export default async function FundTypePage({ params }: Props) {
  const { type } = await params
  const upper = type.toUpperCase()
  if (!VALID_TYPES.includes(upper)) notFound()

  const meta = TYPE_META[upper]
  const label = FUND_TYPE_LABELS[upper] ?? upper
  const isTaxFund = upper === 'SSF' || upper === 'RMF'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          {meta?.title ?? `กองทุน${label}`}
        </h1>
        {meta?.description && (
          <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">{meta.description}</p>
        )}
      </div>

      {/* Tax benefit banner for SSF/RMF */}
      {isTaxFund && meta?.taxBenefit && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4 flex items-start gap-3">
          {upper === 'RMF' ? (
            <PiggyBank className="h-5 w-5 text-green-700 shrink-0 mt-0.5" />
          ) : (
            <Shield className="h-5 w-5 text-green-700 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold text-green-800 text-sm">สิทธิลดหย่อนภาษี</p>
            <p className="text-green-700 text-sm mt-0.5">{meta.taxBenefit}</p>
          </div>
        </div>
      )}

      {/* Quick links to other types */}
      <div className="flex flex-wrap gap-2 mb-6">
        {VALID_TYPES.filter((t) => t !== upper).map((t) => (
          <Link
            key={t}
            href={`/funds/type/${t.toLowerCase()}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            {FUND_TYPE_LABELS[t] ?? t}
          </Link>
        ))}
      </div>

      <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        ข้อมูลเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน กรุณาศึกษาหนังสือชี้ชวนและปรึกษาผู้แนะนำการลงทุน
      </div>

      <Suspense fallback={<div className="text-slate-400 text-sm py-12 text-center">กำลังโหลด...</div>}>
        <TypeFundBrowser fundType={upper} />
      </Suspense>
    </div>
  )
}
