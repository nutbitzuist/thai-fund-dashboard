// app/page.tsx — Homepage
// Server component: renders fast, no client bundle overhead

import Link from 'next/link'
import { TrendingUp, Search, BarChart2, BookOpen, Shield, ArrowRight, Clock } from 'lucide-react'
import { FundSearch } from '@/components/fund/fund-search'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import prisma from '@/lib/db'
import { formatDateTh } from '@/lib/utils'

async function getHomeStats() {
  try {
    const [fundCount, lastSync] = await Promise.all([
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] } } }),
      prisma.syncLog.findFirst({
        where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
    ])
    return { fundCount, lastSync: lastSync?.finishedAt ?? null }
  } catch {
    return { fundCount: 0, lastSync: null }
  }
}

const POPULAR_FUNDS = [
  { label: 'กองทุนตลาดเงิน', q: 'MONEY' },
  { label: 'กองทุนหุ้นไทย', q: 'EQUITY' },
  { label: 'กองทุนพันธบัตร', q: 'BOND' },
  { label: 'กองทุนผสม', q: 'MIXED' },
  { label: 'กองทุนต่างประเทศ', q: 'FOREIGN' },
]

const RISK_EXPLAINERS = [
  {
    level: '1–2',
    label: 'เสี่ยงต่ำ',
    color: 'bg-green-100 text-green-800 border-green-200',
    description: 'กองทุนตลาดเงิน พันธบัตรรัฐบาล ผลตอบแทนต่ำ ความผันผวนน้อย',
  },
  {
    level: '3–4',
    label: 'เสี่ยงปานกลาง',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    description: 'กองทุนผสม ตราสารหนี้ ผสมหุ้นบางส่วน ความผันผวนระดับกลาง',
  },
  {
    level: '5–6',
    label: 'เสี่ยงสูง',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'กองทุนหุ้น ผลตอบแทนอาจสูง แต่ราคาผันผวนมาก',
  },
  {
    level: '7–8',
    label: 'เสี่ยงสูงมาก',
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'กองทุนสินทรัพย์ทางเลือก อนุพันธ์ หรือกองทุนต่างประเทศเสี่ยงสูง',
  },
]

export default async function HomePage() {
  const { fundCount, lastSync } = await getHomeStats()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-700 to-blue-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24 sm:px-6 lg:px-8 text-center">
          {/* Last update badge */}
          {lastSync && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs mb-6 border border-white/20">
              <Clock className="h-3.5 w-3.5" />
              อัปเดตล่าสุด: {formatDateTh(lastSync, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            ค้นหาข้อมูลกองทุนรวมไทย
            <br />
            <span className="text-blue-200">เพื่อการศึกษา</span>
          </h1>
          <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto">
            ข้อมูล NAV ผลตอบแทน ความเสี่ยง และการเปรียบเทียบกองทุน
            {fundCount > 0 && ` จากกองทุนกว่า ${fundCount.toLocaleString('th-TH')} กองทุน`}
          </p>

          {/* Search Box */}
          <div className="max-w-2xl mx-auto">
            <FundSearch
              size="lg"
              placeholder="ค้นหากองทุน เช่น KFFLEX, กองทุนหุ้น, บลจ.กสิกร..."
              className="shadow-xl"
            />
          </div>

          {/* Popular chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {POPULAR_FUNDS.map((f) => (
              <Link
                key={f.q}
                href={`/funds?q=${f.q}`}
                className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 text-sm transition-colors"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Search,
                title: 'ค้นหากองทุน',
                desc: 'ค้นด้วยชื่อ รหัส บลจ. ประเภทกองทุน หรือระดับความเสี่ยง',
                href: '/funds',
                color: 'text-blue-600 bg-blue-50',
              },
              {
                icon: BarChart2,
                title: 'เปรียบเทียบกองทุน',
                desc: 'เปรียบเทียบผลตอบแทนและความเสี่ยงของกองทุนสูงสุด 5 กองทุน',
                href: '/compare',
                color: 'text-purple-600 bg-purple-50',
              },
              {
                icon: TrendingUp,
                title: 'จัดอันดับกองทุน',
                desc: 'กรองกองทุนตามผลตอบแทน ความผันผวน Drawdown หรือ Sharpe Ratio',
                href: '/rankings',
                color: 'text-green-600 bg-green-50',
              },
              {
                icon: BookOpen,
                title: 'เรียนรู้การลงทุน',
                desc: 'ทำความเข้าใจ NAV ผลตอบแทน ความเสี่ยง และวิธีอ่านข้อมูลกองทุน',
                href: '/learn',
                color: 'text-amber-600 bg-amber-50',
              },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group">
                <Card className="h-full hover:shadow-md transition-shadow hover:border-blue-200">
                  <CardContent className="p-5">
                    <div className={`inline-flex rounded-lg p-2.5 mb-3 ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1.5 group-hover:text-blue-700 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Risk Education Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-blue-700" />
              <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">เข้าใจความเสี่ยงกองทุน</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              ระดับความเสี่ยงของกองทุนรวมคืออะไร?
            </h2>
            <p className="text-slate-500 mt-1.5">
              กองทุนรวมไทยมีการจัดระดับความเสี่ยงตั้งแต่ 1 (ต่ำสุด) ถึง 8 (สูงสุด) โดย SEC
            </p>
          </div>
          <Link href="/learn">
            <Button variant="outline" className="shrink-0">
              เรียนรู้เพิ่มเติม <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RISK_EXPLAINERS.map((r) => (
            <div
              key={r.level}
              className={`rounded-xl border p-4 ${r.color}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold">{r.level}</span>
                <span className="font-semibold">{r.label}</span>
              </div>
              <p className="text-sm leading-relaxed opacity-80">{r.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compare CTA */}
      <section className="bg-blue-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3">เปรียบเทียบกองทุนได้ง่ายๆ</h2>
          <p className="text-blue-100 mb-6 max-w-lg mx-auto">
            เลือกกองทุนสูงสุด 5 กองทุนแล้วดูกราฟ Normalized, ตาราง Return และ Risk
            เคียงกันได้เลย — แชร์ URL ให้เพื่อนได้ทันที
          </p>
          <Link href="/compare">
            <Button size="xl" variant="outline" className="bg-white text-blue-700 border-white hover:bg-blue-50">
              เริ่มเปรียบเทียบกองทุน <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="bg-amber-50 border-t border-amber-200">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>ข้อจำกัดความรับผิดชอบ:</strong>{' '}
            เว็บไซต์นี้จัดทำเพื่อการศึกษาเท่านั้น ข้อมูลทั้งหมดไม่ใช่คำแนะนำการลงทุน
            ไม่ใช่คำแนะนำซื้อขาย และไม่ใช่การประเมินความเหมาะสมของนักลงทุน
            ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
            กรุณาปรึกษาผู้แนะนำการลงทุนที่ได้รับอนุญาตก่อนตัดสินใจลงทุน
          </p>
        </div>
      </section>
    </div>
  )
}
