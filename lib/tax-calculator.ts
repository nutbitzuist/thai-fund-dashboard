// Thai personal income tax calculator (PIT 2025 brackets)
// Deduction rules as of tax year 2025 (B.E. 2568)

const BRACKETS: { threshold: number; rate: number }[] = [
  { threshold: 150_000,   rate: 0    },
  { threshold: 300_000,   rate: 0.05 },
  { threshold: 500_000,   rate: 0.10 },
  { threshold: 750_000,   rate: 0.15 },
  { threshold: 1_000_000, rate: 0.20 },
  { threshold: 2_000_000, rate: 0.25 },
  { threshold: 5_000_000, rate: 0.30 },
  { threshold: Infinity,  rate: 0.35 },
]

export function calculateTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0
  let tax = 0
  let prev = 0
  for (const { threshold, rate } of BRACKETS) {
    if (taxableIncome <= prev) break
    const band = Math.min(taxableIncome, threshold) - prev
    tax += band * rate
    prev = threshold
  }
  return Math.max(0, tax)
}

export interface DeductionInputs {
  annualIncome:    number  // gross annual income
  spouseAllowance: 0 | 60_000
  childrenCount:   number  // 0–5, each 30,000
  lifeInsurance:   number  // max 100,000
  providentFund:   number  // employee contribution
  rmfAmount:       number
  ssfAmount:       number
}

export interface TaxResult {
  taxableIncomeBefore:  number
  taxableIncomeAfter:   number
  taxBefore:            number
  taxAfter:             number
  taxSaved:             number
  rmfActualDeduction:   number
  ssfActualDeduction:   number
  combinedCapUsed:      number
  combinedCap:          number
  capWarning:           string | null
}

const PERSONAL_ALLOWANCE = 60_000

export function calculateTaxResult(inputs: DeductionInputs): TaxResult {
  const {
    annualIncome, spouseAllowance, childrenCount,
    lifeInsurance, providentFund, rmfAmount, ssfAmount,
  } = inputs

  // Standard expense deduction: 50% of income, max 100,000
  const expenseDeduction = Math.min(annualIncome * 0.5, 100_000)

  // Fixed deductions (no investment)
  const baseDeductions =
    expenseDeduction +
    PERSONAL_ALLOWANCE +
    spouseAllowance +
    Math.min(childrenCount, 5) * 30_000 +
    Math.min(lifeInsurance, 100_000)

  const taxableIncomeBefore = Math.max(0, annualIncome - baseDeductions)
  const taxBefore = calculateTax(taxableIncomeBefore)

  // Combined retirement savings cap: min(income × 30%, 500,000)
  const combinedCap = Math.min(annualIncome * 0.30, 500_000)
  // SSF own cap: min(income × 30%, 200,000) — within the combined cap
  const ssfCap = Math.min(annualIncome * 0.30, 200_000)

  // Apply provident fund first against combined cap
  const pvfCapped = Math.min(providentFund, combinedCap)
  const remainingCombined = Math.max(0, combinedCap - pvfCapped)

  // SSF: min of user input, its own cap, and remaining combined headroom
  const ssfActual = Math.min(ssfAmount, ssfCap, remainingCombined)
  const remainingAfterSsf = Math.max(0, remainingCombined - ssfActual)

  // RMF: takes the rest of combined headroom
  const rmfActual = Math.min(rmfAmount, remainingAfterSsf)

  const combinedCapUsed = pvfCapped + ssfActual + rmfActual

  const totalDeductions = baseDeductions + pvfCapped + ssfActual + rmfActual
  const taxableIncomeAfter = Math.max(0, annualIncome - totalDeductions)
  const taxAfter = calculateTax(taxableIncomeAfter)

  const inputCombined = providentFund + ssfAmount + rmfAmount
  let capWarning: string | null = null
  if (inputCombined > combinedCap) {
    capWarning = `วงเงินสูงสุด RMF+SSF+กองทุนสำรองฯ รวมกันไม่เกิน ฿${combinedCap.toLocaleString('th-TH')}`
  } else if (ssfAmount > ssfCap) {
    capWarning = `วงเงิน SSF สูงสุด ฿${ssfCap.toLocaleString('th-TH')}`
  }

  return {
    taxableIncomeBefore,
    taxableIncomeAfter,
    taxBefore,
    taxAfter,
    taxSaved: taxBefore - taxAfter,
    rmfActualDeduction: rmfActual,
    ssfActualDeduction: ssfActual,
    combinedCapUsed,
    combinedCap,
    capWarning,
  }
}
