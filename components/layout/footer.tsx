import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-blue-700">
              <TrendingUp className="h-5 w-5" />
              <span>กองทุนไทย Research Dashboard</span>
            </Link>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              แพลตฟอร์มค้นหาข้อมูลกองทุนรวมไทยเพื่อการศึกษา
              ข้อมูลจาก SEC Open API Thailand อัปเดตทุกวันจันทร์–ศุกร์ เวลา 18:30 น.
            </p>
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              ⚠️ เว็บไซต์นี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
              ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900">เมนูหลัก</h3>
            <ul className="mt-3 space-y-2">
              {[
                { href: '/funds', label: 'ค้นหากองทุน' },
                { href: '/compare', label: 'เปรียบเทียบกองทุน' },
                { href: '/rankings', label: 'จัดอันดับกองทุน' },
                { href: '/learn', label: 'เรียนรู้' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-blue-700 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">ข้อมูล</h3>
            <ul className="mt-3 space-y-2">
              {[
                { href: '/methodology', label: 'วิธีคำนวณ' },
                { href: '/about', label: 'เกี่ยวกับเรา' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 hover:text-blue-700 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://api.sec.or.th"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-500 hover:text-blue-700 transition-colors"
                >
                  SEC Open API ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} กองทุนไทย Research Dashboard · ข้อมูลจาก SEC Thailand
          </p>
          <p className="text-xs text-slate-400">
            ไม่เป็นคำแนะนำการลงทุน · ใช้เพื่อการศึกษาเท่านั้น
          </p>
        </div>
      </div>
    </footer>
  )
}
