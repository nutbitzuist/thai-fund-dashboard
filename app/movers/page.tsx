// app/movers/page.tsx — Daily Movers: Today's biggest gainers and losers

import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { MoversClient } from './movers-client'

export const metadata: Metadata = {
  title: 'กองทุนขยับวันนี้',
  description: 'กองทุนรวมไทยที่ NAV ขึ้นและลงมากที่สุดในวันนี้',
}

export default function MoversPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">กองทุนขยับวันนี้</h1>
        <p className="text-slate-500 mt-1 text-sm">
          กองทุนที่ NAV เปลี่ยนแปลงมากที่สุดในวันทำการล่าสุด — เพื่อการศึกษาเท่านั้น
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        การเคลื่อนไหวรายวันไม่ใช่คำแนะนำการลงทุน ผลตอบแทนในอดีตไม่ได้รับประกันอนาคต
      </div>

      <Suspense fallback={<div className="text-slate-400 text-sm py-12 text-center">กำลังโหลด...</div>}>
        <MoversClient />
      </Suspense>
    </div>
  )
}
