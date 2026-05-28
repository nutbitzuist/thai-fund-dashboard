'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, TrendingUp, Calculator } from 'lucide-react'
import { calculateTaxResult, type DeductionInputs } from '@/lib/tax-calculator'
import { cn, formatPct, getReturnColorClass, fundUrl } from '@/lib/utils'

interface FundRow {
  projId: string
  projAbbrName: string | null
  nameTh: string
  amc: { nameTh: string } | null
  returnPct: number | null
}

interface Props {
  topRmf: FundRow[]
  topSsf: FundRow[]
}

function formatBaht(n: number): string {
  return '฿' + Math.round(n).toLocaleString('th-TH')
}

function NumberInput({
  label, value, onChange, max, hint, readOnly = false,
}: {
  label: string; value: number; onChange?: (n: number) => void
  max?: number; hint?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {readOnly ? (
        <div className="h-10 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
          {formatBaht(value)}
        </div>
      ) : (
        <input
          type="number"
          min={0}
          max={max}
          value={value || ''}
          onChange={(e) => onChange?.(Math.max(0, Number(e.target.value)))}
          placeholder="0"
          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      )}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export function RmfSsfClient({ topRmf, topSsf }: Props) {
  const [annualIncome, setAnnualIncome] = useState(0)
  const [spouseAllowance, setSpouseAllowance] = useState<0 | 60_000>(0)
  const [childrenCount, setChildrenCount] = useState(0)
  const [lifeInsurance, setLifeInsurance] = useState(0)
  const [providentFund, setProvidentFund] = useState(0)
  const [rmfAmount, setRmfAmount] = useState(0)
  const [ssfAmount, setSsfAmount] = useState(0)

  const inputs: DeductionInputs = {
    annualIncome, spouseAllowance, childrenCount,
    lifeInsurance, providentFund, rmfAmount, ssfAmount,
  }

  const result = useMemo(() => {
    if (annualIncome <= 0) return null
    return calculateTaxResult(inputs)
  }, [annualIncome, spouseAllowance, childrenCount, lifeInsurance, providentFund, rmfAmount, ssfAmount])

  const maxRmfSsf = annualIncome > 0 ? Math.min(annualIncome * 0.3, 500_000) : 500_000

  return (
    <div className="space-y-8">
      {/* Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 mb-4">ข้อมูลรายได้และค่าลดหย่อน</h2>

          <NumberInput
            label="รายได้ต่อปี (บาท)"
            value={annualIncome}
            onChange={setAnnualIncome}
            hint="รายได้พึงประเมินทั้งปี ก่อนหักค่าใช้จ่าย"
          />

          <NumberInput
            label="ค่าลดหย่อนส่วนตัว"
            value={60_000}
            readOnly
            hint="60,000 บาท (คงที่ตามกฎหมาย)"
          />

          {/* Spouse */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">คู่สมรส (ไม่มีรายได้)</label>
            <div className="flex gap-2">
              {([0, 60_000] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSpouseAllowance(v)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                    spouseAllowance === v
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:border-blue-300'
                  )}
                >
                  {v === 0 ? 'ไม่มี' : `มี (+${formatBaht(60_000)})`}
                </button>
              ))}
            </div>
          </div>

          {/* Children */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">จำนวนบุตร (คนละ 30,000 บาท)</label>
            <select
              value={childrenCount}
              onChange={(e) => setChildrenCount(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} คน{n > 0 ? ` (ลดหย่อน ${formatBaht(n * 30_000)})` : ''}</option>
              ))}
            </select>
          </div>

          <NumberInput
            label="เบี้ยประกันชีวิต (บาท)"
            value={lifeInsurance}
            onChange={setLifeInsurance}
            max={100_000}
            hint="สูงสุด 100,000 บาท"
          />

          <NumberInput
            label="กองทุนสำรองเลี้ยงชีพ (บาท)"
            value={providentFund}
            onChange={setProvidentFund}
            hint="เงินสมทบของลูกจ้าง นับรวมวงเงิน RMF+SSF"
          />

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-800">การลงทุนเพื่อลดหย่อนภาษี</span>
            </div>
            <p className="text-xs text-slate-500 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
              วงเงิน RMF+SSF+กองทุนสำรองฯ รวมกันไม่เกิน {annualIncome > 0 ? formatBaht(maxRmfSsf) : '500,000 บาท'} (30% ของรายได้)
            </p>

            <NumberInput
              label="ลงทุน RMF (บาท)"
              value={rmfAmount}
              onChange={setRmfAmount}
              hint="ไถ่ถอนได้เมื่ออายุ 55 ปี ถือต่อเนื่อง 5 ปี"
            />
            <NumberInput
              label="ลงทุน SSF (บาท)"
              value={ssfAmount}
              onChange={setSsfAmount}
              max={200_000}
              hint="สูงสุด 200,000 บาท ถือไว้ 10 ปี"
            />
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {!result ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 flex flex-col items-center justify-center text-center min-h-64">
              <Calculator className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm">กรอกรายได้ต่อปีเพื่อดูผลการคำนวณ</p>
            </div>
          ) : (
            <>
              {/* Warning */}
              {result.capWarning && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">เกินวงเงินสูงสุด</p>
                    <p className="text-amber-700 text-xs mt-0.5">{result.capWarning}</p>
                    {(result.rmfActualDeduction !== rmfAmount || result.ssfActualDeduction !== ssfAmount) && (
                      <p className="text-amber-700 text-xs mt-1">
                        ลดหย่อนได้จริง: RMF {formatBaht(result.rmfActualDeduction)}, SSF {formatBaht(result.ssfActualDeduction)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Main result card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">ผลการคำนวณภาษี</h2>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">เงินได้สุทธิ (ก่อนลงทุน)</span>
                    <span className="font-medium text-slate-800">{formatBaht(result.taxableIncomeBefore)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">เงินได้สุทธิ (หลังลงทุน)</span>
                    <span className="font-medium text-slate-800">{formatBaht(result.taxableIncomeAfter)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">ภาษีก่อนลงทุน</span>
                      <span className="font-medium text-slate-700">{formatBaht(result.taxBefore)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-500">ภาษีหลังลงทุน</span>
                      <span className="font-medium text-slate-700">{formatBaht(result.taxAfter)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-green-800">ประหยัดภาษีได้</span>
                      <span className="text-2xl font-bold text-green-700">{formatBaht(result.taxSaved)}</span>
                    </div>
                    {result.taxBefore > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        ลดภาษีได้ {((result.taxSaved / result.taxBefore) * 100).toFixed(1)}% จากภาษีเดิม
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bracket summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">อัตราภาษีส่วนเพิ่ม (Marginal Rate)</h3>
                {[
                  { label: '0–150,000', rate: '0%' },
                  { label: '150,001–300,000', rate: '5%' },
                  { label: '300,001–500,000', rate: '10%' },
                  { label: '500,001–750,000', rate: '15%' },
                  { label: '750,001–1,000,000', rate: '20%' },
                  { label: '1,000,001–2,000,000', rate: '25%' },
                  { label: '2,000,001–5,000,000', rate: '30%' },
                  { label: '5,000,001+', rate: '35%' },
                ].map(({ label, rate }) => (
                  <div key={label} className="flex justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-700">{rate}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top funds */}
      {(topRmf.length > 0 || topSsf.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { title: 'กองทุน RMF ผลตอบแทนดีที่สุด (1 ปี)', funds: topRmf, type: 'RMF' },
            { title: 'กองทุน SSF ผลตอบแทนดีที่สุด (1 ปี)', funds: topSsf, type: 'SSF' },
          ].map(({ title, funds, type }) => (
            <div key={type} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">{title}</h3>
              {funds.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">ยังไม่มีข้อมูลผลตอบแทน</p>
              ) : (
                <div className="space-y-2">
                  {funds.map((f, i) => (
                    <Link
                      key={f.projId}
                      href={fundUrl(f)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-blue-700">{f.projAbbrName ?? f.projId}</p>
                        <p className="text-xs text-slate-500 truncate">{f.nameTh}</p>
                      </div>
                      <span className={cn('text-sm font-bold tabular-nums', getReturnColorClass(f.returnPct))}>
                        {f.returnPct != null ? formatPct(f.returnPct) : '-'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <Link
                  href={`/screener?fundType=${type}&sortBy=return1Y&sortDir=desc`}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  ดูกองทุน {type} ทั้งหมด →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        ข้อมูลนี้เป็นการคำนวณเบื้องต้นเพื่อการศึกษา กรุณาตรวจสอบกับนักบัญชีหรือสรรพากรก่อนยื่นแบบภาษี
      </p>
    </div>
  )
}
