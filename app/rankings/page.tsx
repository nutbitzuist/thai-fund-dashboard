// app/rankings/page.tsx — Rankings and Screener

import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { RankingsClient } from './rankings-client'

export const metadata: Metadata = {
  title: 'จัดอันดับกองทุน',
  description: 'จัดอันดับกองทุนรวมไทยตามผลตอบแทน ความผันผวน Drawdown และ Sharpe Ratio เพื่อการศึกษา',
}

export default function RankingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">จัดอันดับกองทุน</h1>
        <p className="text-slate-500 mt-1 text-sm">
          กรองและเรียงลำดับกองทุนตามเกณฑ์ที่เลือก — เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
        </p>
      </div>

      {/* Disclaimer Banner */}
      <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <strong className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />หมายเหตุ:</strong> อันดับนี้จัดทำเพื่อการศึกษาเท่านั้น
        ไม่ใช่คำแนะนำการลงทุน การอยู่ในอันดับสูงไม่ได้หมายความว่าเหมาะสมกับทุกคน
        ผลตอบแทนในอดีตไม่รับประกันอนาคต กรุณาศึกษาข้อมูลเพิ่มเติมก่อนลงทุน
      </div>

      <RankingsClient />
    </div>
  )
}
