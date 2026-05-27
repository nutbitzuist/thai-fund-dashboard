// app/learn/page.tsx — Learning Center

import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, TrendingUp, BarChart2, AlertTriangle, Activity, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'เรียนรู้การลงทุน',
  description: 'ทำความเข้าใจ NAV ผลตอบแทน ความผันผวน Max Drawdown และ Sharpe Ratio ในภาษาไทย',
}

interface ConceptCardProps {
  icon: React.ElementType
  title: string
  formula?: string
  description: string
  example?: string
  note?: string
  color?: string
}

function ConceptCard({ icon: Icon, title, formula, description, example, note, color = 'blue' }: ConceptCardProps) {
  const colorMap: Record<string, { icon: string; bg: string; border: string }> = {
    blue: { icon: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    green: { icon: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    orange: { icon: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    red: { icon: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    purple: { icon: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  }
  const c = colorMap[color] ?? colorMap.blue

  return (
    <Card>
      <CardHeader>
        <div className={`inline-flex p-2.5 rounded-lg ${c.bg} ${c.border} border w-fit mb-2`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {formula && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 font-mono text-sm text-slate-700">
            {formula}
          </div>
        )}
        <p className="text-slate-600 leading-relaxed">{description}</p>
        {example && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            <strong>ตัวอย่าง:</strong> {example}
          </div>
        )}
        {note && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <strong className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />หมายเหตุ:</strong> {note}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-6 w-6 text-blue-700" />
          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wide">ศูนย์เรียนรู้</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">เรียนรู้การลงทุนกองทุนรวม</h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          ทำความเข้าใจคำศัพท์และตัวชี้วัดที่ใช้ในการวิเคราะห์กองทุนรวม
          เพื่อให้คุณสามารถอ่านข้อมูลและเปรียบเทียบกองทุนได้อย่างมีประสิทธิภาพ
        </p>
      </div>

      <div className="space-y-6">
        <ConceptCard
          icon={TrendingUp}
          color="blue"
          title="NAV — มูลค่าหน่วยลงทุน"
          formula="NAV = (สินทรัพย์สุทธิทั้งหมด) / (จำนวนหน่วยลงทุนทั้งหมด)"
          description="NAV (Net Asset Value) หรือมูลค่าหน่วยลงทุน คือราคาต่อหน่วยของกองทุนในวันนั้นๆ คำนวณจากมูลค่าสินทรัพย์ทั้งหมดที่กองทุนถือครองหักด้วยหนี้สิน แล้วหารด้วยจำนวนหน่วยลงทุนทั้งหมดที่มีอยู่ NAV จะประกาศทุกวันทำการ"
          example="ถ้ากองทุนมีสินทรัพย์ 100 ล้านบาท และมีหน่วยลงทุน 10 ล้านหน่วย NAV = 10 บาทต่อหน่วย หากคุณซื้อกองทุนนี้ คุณจะได้รับ 1 หน่วยต่อทุก 10 บาทที่ลงทุน"
        />

        <ConceptCard
          icon={TrendingUp}
          color="green"
          title="ผลตอบแทน (Return)"
          formula="ผลตอบแทน (%) = (NAV ปัจจุบัน - NAV ต้นงวด) / NAV ต้นงวด × 100"
          description="ผลตอบแทนแสดงให้เห็นว่ากองทุนเพิ่มขึ้นหรือลดลงเท่าไรในช่วงเวลาที่เลือก ผลตอบแทนเป็นบวกหมายถึงกองทุนมีกำไร เป็นลบหมายถึงขาดทุน ผลตอบแทนย้อนหลังบอกเพียงสิ่งที่เกิดขึ้นแล้ว ไม่ได้บอกอนาคต"
          example="ถ้า NAV ต้นปีอยู่ที่ 10 บาท และปลายปีอยู่ที่ 11 บาท ผลตอบแทน 1 ปี = (11-10)/10 × 100 = +10%"
          note="ผลตอบแทนย้อนหลังไม่ได้รับประกันผลในอนาคต กองทุนที่ดีที่สุดในปีที่ผ่านมาอาจไม่ใช่กองทุนที่ดีที่สุดในปีหน้า"
        />

        <ConceptCard
          icon={Activity}
          color="orange"
          title="ความผันผวน (Volatility)"
          formula="Volatility (รายปี) = ส่วนเบี่ยงเบนมาตรฐานผลตอบแทนรายวัน × √252 × 100"
          description="ความผันผวนบอกว่า NAV ของกองทุนขึ้นลงมากแค่ไหนในแต่ละวัน คำนวณจากส่วนเบี่ยงเบนมาตรฐานของผลตอบแทนรายวัน แล้วปรับเป็นรายปี (ใช้ 252 วันทำการต่อปี) ยิ่งสูงหมายความว่าราคาแกว่งมาก เสี่ยงมากขึ้น ยิ่งต่ำหมายถึงเสถียรกว่า"
          example="กองทุนหุ้นอาจมี Volatility 15-25% ต่อปี ในขณะที่กองทุนตลาดเงินอาจมีแค่ 0.1-0.5% ต่อปี"
          note="Volatility สูงไม่ได้แปลว่าไม่ดีเสมอไป — กองทุนหุ้นมักมี Volatility สูงแต่ให้ผลตอบแทนในระยะยาวสูงกว่า ควรดูร่วมกับระยะเวลาการลงทุนของตัวเอง"
        />

        <ConceptCard
          icon={AlertTriangle}
          color="red"
          title="Max Drawdown — การลดลงสูงสุด"
          formula="Drawdown = (NAV ปัจจุบัน - NAV จุดสูงสุด) / NAV จุดสูงสุด × 100"
          description="Max Drawdown แสดงให้เห็นว่าถ้าคุณซื้อกองทุนที่จุดสูงสุด แล้วขายที่จุดต่ำสุดในช่วงเวลานั้น คุณจะขาดทุนกี่เปอร์เซ็นต์ เป็นตัววัดความเจ็บปวดสูงสุดที่อาจเกิดขึ้น ยิ่งค่าเป็นลบมาก หมายถึงกองทุนเคยลดลงมากกว่า"
          example="ถ้า Max Drawdown = -30% แปลว่าในช่วงเวลานั้น กองทุนเคยลดลงจากจุดสูงสุดมาก ถึง 30% ณ จุดที่ต่ำที่สุด"
          note="Max Drawdown สำคัญมากสำหรับนักลงทุนที่ไม่สามารถรับการขาดทุนสูงได้ หรือที่อาจต้องการใช้เงินในช่วงตลาดลง"
        />

        <ConceptCard
          icon={BarChart2}
          color="purple"
          title="Sharpe Ratio — ผลตอบแทนเทียบความเสี่ยง"
          formula="Sharpe = (ผลตอบแทน 1 ปี - อัตราดอกเบี้ยไร้ความเสี่ยง) / ความผันผวน 1 ปี"
          description="Sharpe Ratio วัดว่ากองทุนให้ผลตอบแทนส่วนเกินเมื่อเทียบกับความเสี่ยงที่รับมาก ยิ่งสูงยิ่งดีในเชิงทฤษฎี เว็บนี้ใช้อัตราดอกเบี้ยไร้ความเสี่ยงที่ 1.5% ต่อปี ค่า Sharpe เป็นบวกหมายความว่ากองทุนให้ผลตอบแทนมากกว่าเงินฝากไร้ความเสี่ยง"
          example="Sharpe = 1.2 หมายความว่าสำหรับทุกหน่วยความเสี่ยง กองทุนให้ผลตอบแทนส่วนเกิน 1.2 หน่วย ดีกว่า Sharpe = 0.5"
          note="Sharpe Ratio มีข้อจำกัด ใช้เปรียบเทียบกองทุนประเภทเดียวกันเท่านั้น และค่าที่คำนวณได้ขึ้นอยู่กับช่วงเวลาที่เลือก ไม่ควรใช้เพียงตัวเดียวในการตัดสินใจลงทุน"
        />

        {/* Normalized Chart Explanation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-blue-600" />
              กราฟ Normalized — เปรียบเทียบการเติบโต
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 font-mono text-sm text-slate-700">
              NAV Normalized = (NAV ณ วันนั้น / NAV วันแรก) × 100
            </div>
            <p className="text-slate-600 leading-relaxed">
              กราฟ Normalized ปรับให้ทุกกองทุนเริ่มต้นที่ 100 เพื่อให้สามารถเปรียบเทียบ
              การเติบโตสัมพัทธ์ระหว่างกองทุนที่มี NAV ต่างกันมากได้ง่ายขึ้น
              เช่น กองทุน A มี NAV เริ่มต้น 5 บาท กองทุน B มี NAV เริ่มต้น 100 บาท
              กราฟ Normalized ทำให้ทั้งสองเริ่มที่ 100 และดูการเติบโตเป็นเปอร์เซ็นต์ได้
            </p>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              <strong>ตัวอย่าง:</strong> ถ้ากราฟ Normalized ของกองทุน A อยู่ที่ 115 หลังจาก 1 ปี
              หมายความว่ากองทุนนั้นเพิ่มขึ้น 15% จากจุดเริ่มต้น (บนกราฟนั้น)
            </div>
          </CardContent>
        </Card>

        {/* Past Performance Warning */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              ทำไมผลงานในอดีตไม่รับประกันอนาคต?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-amber-900">
            <p className="leading-relaxed">
              กองทุนรวมลงทุนในสินทรัพย์ต่างๆ เช่น หุ้น พันธบัตร อสังหาริมทรัพย์
              ซึ่งราคาเหล่านี้ขึ้นอยู่กับปัจจัยเศรษฐกิจ การเมือง เทคโนโลยี และเหตุการณ์ที่คาดไม่ถึง
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="shrink-0">•</span>
                <span>กองทุนที่ดีที่สุดในปีที่แล้วอาจแย่ที่สุดในปีนี้ เนื่องจากสภาพตลาดเปลี่ยน</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0">•</span>
                <span>ผู้จัดการกองทุนที่เก่งในช่วงตลาดขาขึ้นอาจทำได้ไม่ดีในตลาดขาลง</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0">•</span>
                <span>ค่าใช้จ่ายของกองทุน (TER) ส่งผลต่อผลตอบแทนระยะยาวอย่างมีนัยสำคัญ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0">•</span>
                <span>การลงทุนมีความเสี่ยง ผู้ลงทุนอาจได้รับเงินลงทุนคืนน้อยกว่าเงินลงทุนเริ่มแรก</span>
              </li>
            </ul>
            <p className="text-sm font-semibold mt-4">
              ข้อมูลที่แสดงในเว็บนี้มีไว้เพื่อการศึกษาเท่านั้น กรุณาปรึกษาผู้แนะนำการลงทุนที่ได้รับอนุญาตจาก SEC ก่อนตัดสินใจลงทุน
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/methodology" className="flex items-center justify-center gap-1.5 text-blue-700 hover:underline text-sm">
          ดูวิธีคำนวณโดยละเอียด <ArrowRight className="h-4 w-4" />
        </Link>
        <span className="hidden sm:block text-slate-300">|</span>
        <Link href="/funds" className="flex items-center justify-center gap-1.5 text-blue-700 hover:underline text-sm">
          ไปค้นหากองทุน <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
