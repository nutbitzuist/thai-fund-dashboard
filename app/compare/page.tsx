// app/compare/page.tsx — Fund Comparison Page

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CompareClient } from './compare-client'

export const metadata: Metadata = {
  title: 'เปรียบเทียบกองทุน',
  description: 'เปรียบเทียบผลตอบแทนและความเสี่ยงของกองทุนรวมไทยสูงสุด 5 กองทุน',
}

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">เปรียบเทียบกองทุน</h1>
        <p className="text-slate-500 mt-1 text-sm">
          เพิ่มกองทุนสูงสุด 5 กองทุน แล้วดูผลตอบแทนและความเสี่ยงเคียงกัน
          URL สามารถแชร์ได้
        </p>
      </div>
      <Suspense fallback={<div className="text-slate-400 text-sm py-12 text-center">กำลังโหลด...</div>}>
        <CompareClient />
      </Suspense>
    </div>
  )
}
