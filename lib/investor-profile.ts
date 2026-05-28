export type InvestorGoal = 'tax_saving' | 'growth' | 'income' | 'explore'
export type InvestorHorizon = 'short' | 'medium' | 'long'
export type InvestorRisk = 'low' | 'medium' | 'high'

export interface InvestorProfile {
  goal: InvestorGoal
  horizon: InvestorHorizon
  risk: InvestorRisk
  completedAt: string
}

const KEY = 'investor_profile'

export function getProfile(): InvestorProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as InvestorProfile) : null
  } catch {
    return null
  }
}

export function saveProfile(p: InvestorProfile): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}

export const GOAL_LABELS: Record<InvestorGoal, string> = {
  tax_saving: 'ออมภาษี (RMF/SSF)',
  growth:     'เพิ่มมูลค่าระยะยาว',
  income:     'รับปันผลสม่ำเสมอ',
  explore:    'สำรวจและศึกษา',
}

export const HORIZON_LABELS: Record<InvestorHorizon, string> = {
  short:  'น้อยกว่า 1 ปี',
  medium: '1–3 ปี',
  long:   'มากกว่า 3 ปี',
}

export const RISK_LABELS: Record<InvestorRisk, string> = {
  low:    'ต่ำ — รักษาเงินต้น (ระดับ 1–3)',
  medium: 'กลาง — ยอมรับผันผวนได้บ้าง (ระดับ 4–5)',
  high:   'สูง — ต้องการผลตอบแทนสูงสุด (ระดับ 6–8)',
}

export function profileToScreenerUrl(p: InvestorProfile): string {
  const params = new URLSearchParams()
  if (p.goal === 'tax_saving') {
    params.set('fundType', 'RMF')
    params.set('sortBy', 'return1Y')
    params.set('sortDir', 'desc')
  } else if (p.goal === 'growth') {
    const type = p.risk === 'high' ? 'FIF' : p.risk === 'medium' ? 'BA' : 'FI'
    params.set('fundType', type)
    params.set('sortBy', 'return1Y')
    params.set('sortDir', 'desc')
  } else if (p.goal === 'income') {
    params.set('fundType', 'FI')
    params.set('dividendPolicy', 'PAID')
    params.set('sortBy', 'return1Y')
    params.set('sortDir', 'desc')
  }
  const qs = params.toString()
  return qs ? `/screener?${qs}` : '/screener'
}
