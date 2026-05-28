import type { Metadata } from 'next'
import { Sparkles } from 'lucide-react'
import { TwinClient } from './twin-client'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'กองทุนฝาแฝด — หากองทุนที่ดีกว่าที่คุณถืออยู่',
  description: 'ค้นหากองทุนรวมไทยที่มีประเภทและความเสี่ยงใกล้เคียง แต่ให้ผลตอบแทน 1 ปีดีกว่ากองทุนที่คุณถืออยู่',
  keywords: ['กองทุนฝาแฝด', 'เปรียบเทียบกองทุน', 'กองทุนดีกว่า', 'สลับกองทุน'],
}

export default function TwinPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-blue-700" />
          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">เครื่องมือลงทุน</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">กองทุนฝาแฝด</h1>
        <p className="text-slate-500 text-sm mt-1">คุณถือกองทุนนี้อยู่ แต่มีที่ดีกว่าไหม?</p>
      </div>
      <TwinClient />
    </div>
  )
}
