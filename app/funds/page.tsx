// app/funds/page.tsx — Fund browse and screener

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { FundBrowser } from './fund-browser'

export const metadata: Metadata = {
  title: 'ค้นหากองทุน',
  description: 'ค้นหากองทุนรวมไทยทุกกองทุน กรองตามประเภท ความเสี่ยง บลจ. และเรียงตามผลตอบแทน',
}

export default function FundsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ค้นหากองทุนรวม</h1>
        <p className="text-slate-500 mt-1 text-sm">
          กรองและค้นหากองทุนรวมไทยจากข้อมูล SEC Open API เพื่อการศึกษา
        </p>
      </div>
      <Suspense fallback={<div className="text-slate-400 text-sm py-12 text-center">กำลังโหลด...</div>}>
        <FundBrowser />
      </Suspense>
    </div>
  )
}
