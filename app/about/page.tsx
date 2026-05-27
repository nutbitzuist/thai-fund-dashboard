// app/about/page.tsx — About Page

import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, Heart, Mail, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'เกี่ยวกับเรา',
  description: 'เกี่ยวกับ กองทุนไทย Research Dashboard — แพลตฟอร์มวิจัยกองทุนรวมไทยเพื่อการศึกษา',
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">เกี่ยวกับ กองทุนไทย Research Dashboard</h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          แพลตฟอร์มค้นหาข้อมูลกองทุนรวมไทยสำหรับนักลงทุนไทย
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4 text-slate-700">
            <h2 className="text-xl font-bold text-slate-900">วัตถุประสงค์</h2>
            <p className="leading-relaxed">
              เว็บไซต์นี้จัดทำขึ้นเพื่อช่วยให้นักลงทุนไทยสามารถ:
            </p>
            <ul className="list-disc ml-5 space-y-2">
              <li>ค้นหาและเปรียบเทียบข้อมูลกองทุนรวมไทยได้ง่ายในที่เดียว</li>
              <li>ทำความเข้าใจตัวชี้วัดทางการเงินในภาษาไทยที่เข้าใจง่าย</li>
              <li>เห็นประวัติ NAV และการเปลี่ยนแปลงในรูปแบบกราฟ</li>
              <li>กรองและจัดอันดับกองทุนตามเกณฑ์ที่สนใจ</li>
            </ul>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              <strong className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />ข้อสำคัญ:</strong> เว็บไซต์นี้ <strong>ไม่ใช่</strong>การให้คำแนะนำการลงทุน
              ไม่มีการประเมินความเหมาะสมของนักลงทุน และไม่มีการแนะนำซื้อ-ขายกองทุนใดๆ
              ข้อมูลทั้งหมดเพื่อการศึกษาเท่านั้น
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3 text-slate-700">
            <h2 className="text-xl font-bold text-slate-900">แหล่งข้อมูล</h2>
            <p className="leading-relaxed">
              ข้อมูลกองทุนและ NAV ทั้งหมดมาจาก{' '}
              <a
                href="https://api.sec.or.th"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline inline-flex items-center gap-0.5"
              >
                SEC Open API Thailand <ExternalLink className="h-3.5 w-3.5" />
              </a>{' '}
              ซึ่งเป็นข้อมูลสาธารณะจากสำนักงานคณะกรรมการกำกับหลักทรัพย์และตลาดหลักทรัพย์ (ก.ล.ต.)
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-slate-600">
              <li>ข้อมูลอัปเดตอัตโนมัติทุกวันทำการ เวลา 18:30 น.</li>
              <li>NAV ย้อนหลังสูงสุด 5 ปี</li>
              <li>ตัวชี้วัดคำนวณใหม่ทุกวัน</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3 text-slate-700">
            <h2 className="text-xl font-bold text-slate-900">เทคโนโลยี</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Frontend', 'Next.js 15, TypeScript, Tailwind CSS'],
                ['Charts', 'Recharts'],
                ['Database', 'PostgreSQL (Neon)'],
                ['ORM', 'Prisma'],
                ['Hosting', 'Vercel Hobby Plan'],
                ['Data', 'SEC Open API Thailand'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="font-medium text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3 text-slate-700">
            <h2 className="text-xl font-bold text-slate-900">ข้อจำกัดความรับผิดชอบ (Disclaimer)</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>
                เว็บไซต์นี้เป็นโปรเจกต์ส่วนตัวที่ไม่ได้รับการรับรองจาก ก.ล.ต. หรือหน่วยงานใดๆ
                ข้อมูลที่แสดงอาจมีความล่าช้า ไม่ครบถ้วน หรือไม่ถูกต้อง
              </p>
              <p>
                การลงทุนมีความเสี่ยง ผู้ลงทุนควรศึกษาข้อมูลจากหนังสือชี้ชวน
                และปรึกษาผู้แนะนำการลงทุนที่ได้รับอนุญาตจาก ก.ล.ต. ก่อนตัดสินใจลงทุน
              </p>
              <p>
                ผู้จัดทำไม่รับผิดชอบต่อความสูญเสียหรือความเสียหายใดๆ
                ที่เกิดจากการนำข้อมูลในเว็บไซต์นี้ไปใช้ในการตัดสินใจลงทุน
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/methodology" className="text-blue-700 hover:underline">
            วิธีคำนวณ
          </Link>
          <Link href="/learn" className="text-blue-700 hover:underline">
            ศูนย์เรียนรู้
          </Link>
          <a
            href="https://www.sec.or.th/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline inline-flex items-center gap-0.5"
          >
            SEC Thailand <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://api.sec.or.th"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline inline-flex items-center gap-0.5"
          >
            SEC Open API <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          จัดทำด้วย <Heart className="h-3 w-3 text-red-400" /> เพื่อนักลงทุนไทย
        </p>
      </div>
    </div>
  )
}
