// app/methodology/page.tsx — Methodology and Data Source

import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Code, Clock, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'วิธีคำนวณและแหล่งข้อมูล',
  description: 'แหล่งข้อมูล วิธีคำนวณตัวชี้วัด และข้อจำกัดของระบบ',
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">วิธีคำนวณและแหล่งข้อมูล</h1>
        <p className="text-slate-500 leading-relaxed">
          เอกสารนี้อธิบายแหล่งข้อมูล วิธีคำนวณตัวชี้วัดทางการเงิน
          และข้อสมมติฐานที่ใช้ในระบบ
        </p>
      </div>

      <div className="space-y-6">
        {/* Data Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              แหล่งข้อมูล
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700">
            <p>ข้อมูลทั้งหมดมาจาก <strong>SEC Open API Thailand</strong></p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm font-mono">
              <p>Base URL: https://api.sec.or.th</p>
              <p>Auth: Ocp-Apim-Subscription-Key</p>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Endpoint ที่ใช้:</strong></p>
              <ul className="space-y-1.5 ml-4">
                <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">GET /FundFactsheet/fund/amc</code> — รายชื่อ บลจ. ทั้งหมด</li>
                <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">GET /FundFactsheet/fund/amc/{'{unique_id}'}</code> — รายชื่อกองทุนของ บลจ.</li>
                <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">GET /FundDailyInfo/{'{proj_id}'}/dailynav/{'{YYYY-MM-DD}'}</code> — NAV รายวัน</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Update Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              ตารางอัปเดตข้อมูล
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-700 text-sm">
            <p>ระบบอัปเดตข้อมูลอัตโนมัติทุกวันจันทร์–ศุกร์ เวลา <strong>18:30 น.</strong> (เวลาประเทศไทย)</p>
            <p>ผ่าน Vercel Cron Job ที่ schedule: <code className="bg-slate-100 px-1.5 py-0.5 rounded">30 11 * * *</code> (UTC)</p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
              <p className="font-medium">ขั้นตอนการ Sync:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>ตรวจสอบ CRON_SECRET</li>
                <li>Sync รายชื่อ บลจ.</li>
                <li>Sync ข้อมูลกองทุนของแต่ละ บลจ.</li>
                <li>ดึง NAV เฉพาะวันที่ขาดหายไป</li>
                <li>คำนวณตัวชี้วัดใหม่</li>
                <li>บันทึก SyncLog</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Calculation Formulas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-blue-600" />
              สูตรคำนวณ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {[
              {
                title: 'ผลตอบแทน (Period Return)',
                formula: 'Return (%) = (NAV_end - NAV_start) / NAV_start × 100',
              },
              {
                title: 'ผลตอบแทนรายวัน (Daily Return)',
                formula: 'R_t = NAV_t / NAV_{t-1} - 1',
              },
              {
                title: 'ความผันผวนรายปี (Annualized Volatility)',
                formula: 'Volatility = StdDev(R_daily) × √252 × 100',
                note: 'ใช้ 252 วันทำการต่อปี (มาตรฐานสากล)',
              },
              {
                title: 'Max Drawdown',
                formula: 'DD_t = (NAV_t - Peak_t) / Peak_t × 100\nMax Drawdown = min(DD_t)',
                note: 'Peak_t คือ NAV สูงสุดตั้งแต่ต้นจนถึงวัน t',
              },
              {
                title: 'Sharpe Ratio',
                formula: 'Sharpe = (Return_1Y / 100 - Rf) / (Volatility_1Y / 100)\nRf = 0.015 (1.5% ต่อปี)',
                note: 'อัตราดอกเบี้ยไร้ความเสี่ยง (Rf) ใช้ 1.5% เป็น default (ปรับได้ผ่าน Environment Variable RISK_FREE_RATE)',
              },
              {
                title: 'Normalized NAV',
                formula: 'NAV_normalized_t = (NAV_t / NAV_first) × 100',
                note: 'NAV_first คือ NAV วันแรกในช่วงเวลาที่เลือก',
              },
            ].map((item) => (
              <div key={item.title} className="border border-slate-200 rounded-lg p-4">
                <p className="font-semibold text-slate-900 mb-2">{item.title}</p>
                <code className="block bg-slate-50 rounded px-3 py-2 text-xs whitespace-pre-wrap font-mono text-slate-700">
                  {item.formula}
                </code>
                {item.note && (
                  <p className="text-xs text-slate-500 mt-1.5">{item.note}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* API Limitations */}
        <Card>
          <CardHeader>
            <CardTitle>ข้อจำกัดของ API และการจัดการข้อมูล</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="space-y-2">
              <p><strong>ข้อจำกัด SEC API:</strong></p>
              <ul className="list-disc ml-4 space-y-1">
                <li>FundDailyInfo รับ NAV ได้ครั้งละ 1 วันเท่านั้น ไม่รองรับ date range</li>
                <li>ระบบ generate วันทำการแล้วดึงทีละวัน พร้อม rate limiting</li>
                <li>NAV ที่มีอยู่ในฐานข้อมูลแล้วจะไม่ดึงซ้ำ (เว้นแต่เปิด force refresh)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p><strong>Class Matching Rule:</strong></p>
              <ul className="list-disc ml-4 space-y-1">
                <li><code>proj_abbr_name</code> จาก Factsheet และ <code>class_abbr_name</code> จาก DailyInfo เป็นคนละ concept</li>
                <li>ระบบบันทึกทุก class ที่ได้รับจาก DailyInfo</li>
                <li><strong>Default Class Rule:</strong> เลือก class ที่ชื่อลงท้ายด้วย &ldquo;-A&rdquo; ก่อน ถ้าไม่มีให้ใช้ตัวแรก (เรียงตามตัวอักษร)</li>
                <li>ตัวชี้วัดคำนวณจาก default class เท่านั้น</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p><strong>Missing Data Handling:</strong></p>
              <ul className="list-disc ml-4 space-y-1">
                <li>วันหยุดราชการและวันหยุดกองทุนจะไม่มีข้อมูล NAV</li>
                <li>ตัวชี้วัดจะคำนวณเฉพาะวันที่มีข้อมูล ไม่ทำ interpolation</li>
                <li>กองทุนที่มีข้อมูล NAV น้อยกว่า 5 วัน จะไม่คำนวณตัวชี้วัด</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              ข้อจำกัดความรับผิดชอบ
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-900 space-y-2">
            <p>เว็บไซต์นี้เป็นโปรเจกต์ส่วนตัวที่จัดทำเพื่อการศึกษาเท่านั้น</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>ข้อมูลทั้งหมดมาจาก SEC Open API ระบบอาจมีความล่าช้าหรือข้อผิดพลาด</li>
              <li>ตัวชี้วัดที่คำนวณได้เป็นเพียงการประมาณการ อาจแตกต่างจากแหล่งข้อมูลอื่น</li>
              <li>ไม่มีการให้คำแนะนำการลงทุน ไม่ประเมินความเหมาะสมของผู้ลงทุน</li>
              <li>กรุณาตรวจสอบข้อมูลจากแหล่งทางการและปรึกษาผู้แนะนำการลงทุนที่ได้รับอนุญาต</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
