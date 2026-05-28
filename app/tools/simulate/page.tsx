import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LineChart } from 'lucide-react'
import { SimulateClient } from './simulate-client'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'จำลองการลงทุน — ถ้าซื้อกองทุนนี้จะได้เท่าไร?',
  description: 'จำลองผลตอบแทนการลงทุนในกองทุนรวมไทย ใส่เงินลงทุนและช่วงเวลาเพื่อดูว่าพอร์ตจะเติบโตเท่าไร',
}

export default function SimulatePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <LineChart className="h-5 w-5 text-blue-700" />
          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">เครื่องมือลงทุน</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">จำลองการลงทุน</h1>
        <p className="text-slate-500 text-sm mt-1">ถ้าซื้อกองทุนนี้ตั้งแต่วันนั้น จะได้เท่าไร?</p>
      </div>
      <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-400 text-sm">กำลังโหลด...</div>}>
        <SimulateClient />
      </Suspense>
    </div>
  )
}
