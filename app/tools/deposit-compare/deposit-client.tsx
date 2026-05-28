'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info } from 'lucide-react'
import { cn, formatPct, getReturnColorClass, fundUrl } from '@/lib/utils'

interface BankRate { bank: string; abbr: string; rate: number }
interface BankRates {
  updatedAt: string
  savings: BankRate[]
  fixed12m: BankRate[]
}
interface FundRow {
  projId: string
  projAbbrName: string | null
  nameTh: string
  returnPct: number | null
}
interface Props {
  topMM: FundRow[]
  topFI: FundRow[]
  bankRates: BankRates
}

type BankTab = 'savings' | 'fixed12m'
type FundTab = 'MM' | 'FI'

const BANK_TAB_LABELS: Record<BankTab, string> = {
  savings: 'ออมทรัพย์',
  fixed12m: 'ฝากประจำ 12 เดือน',
}
const FUND_TAB_LABELS: Record<FundTab, string> = {
  MM: 'กองทุนตลาดเงิน',
  FI: 'กองทุนตราสารหนี้',
}

export function DepositClient({ topMM, topFI, bankRates }: Props) {
  const [bankTab, setBankTab] = useState<BankTab>('savings')
  const [fundTab, setFundTab] = useState<FundTab>('MM')

  const bankList = bankRates[bankTab]
  const fundList = fundTab === 'MM' ? topMM : topFI

  const bestBankRate = Math.max(...bankList.map((b) => b.rate))
  const bestFundReturn = fundList.length > 0 && fundList[0].returnPct != null ? fundList[0].returnPct : null
  const maxRate = Math.max(bestBankRate, bestFundReturn ?? 0) || 5

  const diff = bestFundReturn != null ? bestFundReturn - bestBankRate : null

  return (
    <div className="space-y-6">
      {/* Headline comparison */}
      {diff !== null && (
        <div className={cn(
          'rounded-2xl border p-5',
          diff > 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        )}>
          <p className="text-sm font-medium text-slate-600 mb-1">
            {FUND_TAB_LABELS[fundTab]}ดีที่สุด vs {BANK_TAB_LABELS[bankTab]}สูงสุด
          </p>
          <p className={cn('text-2xl font-bold', diff > 0 ? 'text-emerald-700' : 'text-amber-700')}>
            {diff > 0
              ? `กองทุนให้ผลตอบแทนสูงกว่าเงินฝาก ${diff.toFixed(2)}% ต่อปี`
              : `เงินฝากให้ดอกเบี้ยสูงกว่ากองทุน ${Math.abs(diff).toFixed(2)}% ต่อปี`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            กองทุน {bestFundReturn?.toFixed(2)}% · เงินฝาก {bestBankRate.toFixed(2)}%
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank side */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">ดอกเบี้ยเงินฝากธนาคาร</h2>
            <p className="text-xs text-slate-400">อัปเดต: {bankRates.updatedAt}</p>
          </div>

          {/* Bank tab toggle */}
          <div className="flex gap-2 mb-5">
            {(['savings', 'fixed12m'] as BankTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setBankTab(t)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                  bankTab === t
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300'
                )}
              >
                {BANK_TAB_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {bankList.sort((a, b) => b.rate - a.rate).map((b) => (
              <div key={b.abbr}>
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{b.abbr}</span>
                    <span className="text-xs text-slate-400 ml-2">{b.bank}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700 tabular-nums">{b.rate.toFixed(2)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-400 transition-all"
                    style={{ width: `${(b.rate / maxRate) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
            <Info className="h-3 w-3 shrink-0" />
            อัตราดอกเบี้ยมาตรฐาน อาจมีบัญชีพิเศษที่ให้ดอกเบี้ยสูงกว่า
          </p>
        </div>

        {/* Fund side */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">ผลตอบแทนกองทุน (1 ปี)</h2>
          </div>

          {/* Fund tab toggle */}
          <div className="flex gap-2 mb-5">
            {(['MM', 'FI'] as FundTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setFundTab(t)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                  fundTab === t
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300'
                )}
              >
                {FUND_TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {fundList.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">ยังไม่มีข้อมูลผลตอบแทน</p>
          ) : (
            <div className="space-y-3">
              {fundList.map((f) => (
                <Link key={f.projId} href={fundUrl(f)} className="block group">
                  <div className="flex justify-between items-center mb-1">
                    <div className="min-w-0">
                      <span className="text-xs font-mono font-bold text-blue-700 group-hover:underline">
                        {f.projAbbrName ?? f.projId}
                      </span>
                      <span className="text-xs text-slate-400 ml-2 truncate hidden sm:inline">
                        {f.nameTh.length > 30 ? f.nameTh.slice(0, 30) + '…' : f.nameTh}
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold tabular-nums shrink-0 ml-2', getReturnColorClass(f.returnPct))}>
                      {f.returnPct != null ? formatPct(f.returnPct) : '—'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (f.returnPct ?? 0) >= 0 ? 'bg-emerald-400' : 'bg-red-400'
                      )}
                      style={{ width: `${Math.abs(f.returnPct ?? 0) / maxRate * 100}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              href={`/screener?fundType=${fundTab}&sortBy=return1Y&sortDir=desc`}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              ดูกองทุน{FUND_TAB_LABELS[fundTab]}ทั้งหมด →
            </Link>
          </div>
        </div>
      </div>

      {/* Visual bar comparison */}
      {bestFundReturn !== null && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            เปรียบเทียบผลตอบแทนสูงสุด — {BANK_TAB_LABELS[bankTab]} vs {FUND_TAB_LABELS[fundTab]}
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{BANK_TAB_LABELS[bankTab]} (สูงสุด)</span>
                <span className="font-semibold text-slate-700">{bestBankRate.toFixed(2)}% ต่อปี</span>
              </div>
              <div className="h-6 rounded-lg bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-lg bg-slate-400 flex items-center justify-end pr-2 transition-all"
                  style={{ width: `${(bestBankRate / maxRate) * 100}%` }}
                >
                  <span className="text-xs text-white font-bold">{bestBankRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{FUND_TAB_LABELS[fundTab]} (อันดับ 1)</span>
                <span className={cn('font-semibold', getReturnColorClass(bestFundReturn))}>
                  {bestFundReturn.toFixed(2)}% ต่อปี
                </span>
              </div>
              <div className="h-6 rounded-lg bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-lg flex items-center justify-end pr-2 transition-all',
                    bestFundReturn >= 0 ? 'bg-emerald-500' : 'bg-red-400'
                  )}
                  style={{ width: `${Math.abs(bestFundReturn) / maxRate * 100}%` }}
                >
                  <span className="text-xs text-white font-bold">{bestFundReturn.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            * ผลตอบแทนกองทุนอ้างอิงข้อมูล 1 ปีย้อนหลัง ผลตอบแทนในอดีตไม่รับประกันอนาคต
          </p>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        ข้อมูลนี้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน กรุณาศึกษาข้อมูลเพิ่มเติมก่อนตัดสินใจ
      </p>
    </div>
  )
}
