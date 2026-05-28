'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Target, TrendingUp, DollarSign, Compass, Clock, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  InvestorGoal, InvestorHorizon, InvestorRisk,
  InvestorProfile, saveProfile, profileToScreenerUrl,
  GOAL_LABELS, HORIZON_LABELS, RISK_LABELS,
} from '@/lib/investor-profile'

interface QuizModalProps {
  open: boolean
  onClose: () => void
}

const GOAL_OPTIONS: { value: InvestorGoal; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { value: 'tax_saving', icon: DollarSign, desc: 'ลดหย่อนภาษีด้วย RMF / SSF' },
  { value: 'growth',     icon: TrendingUp, desc: 'ลงทุนระยะยาวเพื่อเพิ่มมูลค่า' },
  { value: 'income',     icon: Target,     desc: 'รับปันผลสม่ำเสมอ' },
  { value: 'explore',    icon: Compass,    desc: 'เพิ่งเริ่มต้น อยากรู้จักกองทุน' },
]

const HORIZON_OPTIONS: { value: InvestorHorizon; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'short',  icon: Clock },
  { value: 'medium', icon: Clock },
  { value: 'long',   icon: Clock },
]

const RISK_OPTIONS: { value: InvestorRisk; color: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'low',    color: 'border-green-300 hover:border-green-500 data-[selected=true]:bg-green-50 data-[selected=true]:border-green-500',  icon: Shield },
  { value: 'medium', color: 'border-amber-300 hover:border-amber-500 data-[selected=true]:bg-amber-50 data-[selected=true]:border-amber-500',  icon: TrendingUp },
  { value: 'high',   color: 'border-red-300 hover:border-red-500 data-[selected=true]:bg-red-50 data-[selected=true]:border-red-500',          icon: Zap },
]

export function QuizModal({ open, onClose }: QuizModalProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<InvestorGoal | null>(null)
  const [horizon, setHorizon] = useState<InvestorHorizon | null>(null)
  const [risk, setRisk] = useState<InvestorRisk | null>(null)

  const handleClose = () => {
    setStep(0); setGoal(null); setHorizon(null); setRisk(null)
    onClose()
  }

  const handleComplete = (selectedRisk: InvestorRisk) => {
    if (!goal || !horizon) return
    const profile: InvestorProfile = {
      goal, horizon, risk: selectedRisk, completedAt: new Date().toISOString(),
    }
    saveProfile(profile)
    handleClose()
    router.push(profileToScreenerUrl(profile))
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">ขั้นตอน {step + 1} จาก 3</span>
              <Dialog.Close asChild>
                <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${((step + 1) / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Step 0: Goal */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">เป้าหมายการลงทุนของคุณคืออะไร?</h2>
              <p className="text-sm text-slate-500 mb-4">เลือกเพื่อให้เราแนะนำกองทุนที่เหมาะกับคุณ</p>
              <div className="grid grid-cols-2 gap-2">
                {GOAL_OPTIONS.map(({ value, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => { setGoal(value); setStep(1) }}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50',
                      goal === value ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                    )}
                  >
                    <Icon className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-900">{GOAL_LABELS[value]}</span>
                    <span className="text-xs text-slate-500">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Horizon */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">ระยะเวลาที่คุณวางแผนลงทุน?</h2>
              <p className="text-sm text-slate-500 mb-4">ระยะเวลายาวนานขึ้น = ยอมรับความเสี่ยงได้มากขึ้น</p>
              <div className="flex flex-col gap-2">
                {HORIZON_OPTIONS.map(({ value }) => (
                  <button
                    key={value}
                    onClick={() => { setHorizon(value); setStep(2) }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:border-blue-400 hover:bg-blue-50',
                      horizon === value ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                    )}
                  >
                    <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                    <span className="text-sm font-medium text-slate-900">{HORIZON_LABELS[value]}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(0)} className="mt-4 text-xs text-slate-400 hover:text-slate-600">← ย้อนกลับ</button>
            </div>
          )}

          {/* Step 2: Risk */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">รับความเสี่ยงได้ระดับไหน?</h2>
              <p className="text-sm text-slate-500 mb-4">หากพอร์ตลดลง 20% คุณจะรู้สึกอย่างไร?</p>
              <div className="flex flex-col gap-2">
                {RISK_OPTIONS.map(({ value, color, icon: Icon }) => (
                  <button
                    key={value}
                    data-selected={risk === value}
                    onClick={() => { setRisk(value); handleComplete(value) }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                      color
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-slate-600" />
                    <span className="text-sm font-medium text-slate-900">{RISK_LABELS[value]}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="mt-4 text-xs text-slate-400 hover:text-slate-600">← ย้อนกลับ</button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
