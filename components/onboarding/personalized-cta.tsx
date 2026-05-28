'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight, Calculator } from 'lucide-react'
import { getProfile, GOAL_LABELS, profileToScreenerUrl } from '@/lib/investor-profile'

export function PersonalizedCta() {
  const [profile, setProfile] = useState<ReturnType<typeof getProfile>>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setProfile(getProfile())
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (!profile) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 flex items-center gap-4">
        <Sparkles className="h-5 w-5 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900">ยังไม่รู้ว่ากองทุนไหนเหมาะกับคุณ?</p>
          <p className="text-xs text-blue-700 mt-0.5">ทำแบบทดสอบ 3 ข้อ รับคำแนะนำกองทุนส่วนตัว</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event('open-quiz'))}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
        >
          เริ่มต้น <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const goalLabel = GOAL_LABELS[profile.goal]
  const screenerUrl = profileToScreenerUrl(profile)

  return (
    <div className="rounded-2xl border border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5">
      <div className="flex items-start gap-3 mb-3">
        <Sparkles className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-900">สำหรับคุณ — เป้าหมาย: {goalLabel}</p>
          <p className="text-xs text-green-700 mt-0.5">กองทุนที่แนะนำตามโปรไฟล์ของคุณ</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={screenerUrl}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors"
        >
          ดูกองทุนแนะนำ <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {profile.goal === 'tax_saving' && (
          <Link
            href="/tools/rmf-ssf"
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
          >
            <Calculator className="h-3.5 w-3.5" />
            คำนวณภาษีที่ประหยัดได้
          </Link>
        )}
        <button
          onClick={() => window.dispatchEvent(new Event('open-quiz'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-4 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
        >
          แก้ไขโปรไฟล์
        </button>
      </div>
    </div>
  )
}
