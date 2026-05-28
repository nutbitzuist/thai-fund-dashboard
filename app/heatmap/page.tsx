import type { Metadata } from 'next'
import { LayoutGrid } from 'lucide-react'
import { HeatmapClient } from './heatmap-client'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Heatmap กองทุน — ภาพรวมตลาดกองทุนวันนี้',
  description: 'ดูภาพรวมตลาดกองทุนรวมไทยในรูปแบบ Heatmap สีแสดงการเปลี่ยนแปลง NAV รายวัน แยกตามประเภทกองทุน',
  keywords: ['heatmap กองทุน', 'ภาพรวมตลาดกองทุน', 'กองทุนรวมวันนี้', 'NAV เปลี่ยนแปลง'],
}

export default function HeatmapPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <LayoutGrid className="h-5 w-5 text-blue-700" />
          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">ตลาดวันนี้</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Heatmap กองทุนรวม</h1>
        <p className="text-slate-500 text-sm mt-1">ภาพรวมการเปลี่ยนแปลง NAV รายวัน แยกตามหมวดหมู่</p>
      </div>
      <HeatmapClient />
    </div>
  )
}
