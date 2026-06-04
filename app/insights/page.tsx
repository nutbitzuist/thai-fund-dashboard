// app/insights/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SEO_LANDING_PAGES } from '@/lib/bulltiq-content';

export const metadata: Metadata = {
  title: 'Bulltiq Insights — คัดกองทุนแบบอ่านง่าย',
  description: 'หน้า SEO และ insight สำหรับคัดกองทุนไทยจากผลตอบแทน ความเสี่ยง Health Score และคุณภาพข้อมูลย้อนหลัง',
};

export default function InsightsIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-3">
        <Badge className="bg-blue-700 text-white">Bulltiq Insights</Badge>
        <h1 className="text-3xl font-bold text-slate-900">คัดกองทุนแบบอ่านง่าย</h1>
        <p className="max-w-3xl text-slate-600 leading-7">
          รวมหน้าจัดอันดับและคำอธิบายภาษาไทยสำหรับนักลงทุนที่อยากเริ่มคัดกองทุนจากข้อมูลจริง ไม่ใช่ดูผลตอบแทนย้อนหลังเพียงตัวเดียว
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SEO_LANDING_PAGES.map((page) => (
          <Link key={page.slug} href={`/insights/${page.slug}`}>
            <Card className="h-full hover:border-blue-200 hover:shadow-md transition-all">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">{page.metric}</Badge>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{page.h1}</h2>
                <p className="text-sm leading-6 text-slate-600">{page.description}</p>
                <p className="text-xs text-slate-500">เหมาะกับ: {page.audience}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
