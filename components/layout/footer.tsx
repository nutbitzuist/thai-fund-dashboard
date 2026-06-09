import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import prisma from '@/lib/db'
import { formatDateTh } from '@/lib/utils'

// Cached: DB hit at most once per 30 minutes across all concurrent requests.
const getNavFreshness = unstable_cache(
  async () => {
    const record = await prisma.navPrice.findFirst({
      orderBy: { navDate: 'desc' },
      select: { navDate: true },
    });
    if (!record) return { date: null, daysSince: 999 };
    const date = new Date(record.navDate);
    const daysSince = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    return { date: date.toISOString().split('T')[0], daysSince };
  },
  ['footer-nav-freshness'],
  { revalidate: 1800 }
);

function ChartMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden="true">
      <rect x="1"    y="12" width="4.5" height="7"  rx="1.5" />
      <rect x="7.75" y="7"  width="4.5" height="12" rx="1.5" />
      <rect x="14.5" y="2"  width="4.5" height="17" rx="1.5" />
    </svg>
  )
}

export async function Footer() {
  const { date: lastNavDate, daysSince } = await getNavFreshness();
  const stale = daysSince > 3;
  return (
    <footer className="bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">

          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-white">
              <ChartMark className="h-5 w-5 text-blue-400" />
              <span>กองทุนไทย Research Dashboard</span>
            </Link>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              แพลตฟอร์มค้นหาข้อมูลกองทุนรวมไทยเพื่อการศึกษา
              ข้อมูลจาก SEC Open API Thailand อัปเดตทุกวันจันทร์–ศุกร์ เวลา 18:30 น.
            </p>
            <p className={`mt-2 text-xs leading-relaxed ${stale ? 'text-amber-400' : 'text-slate-500'}`}>
              {stale && '⚠️ '}
              {lastNavDate
                ? `ข้อมูล NAV ล่าสุด: ${formatDateTh(lastNavDate)}${stale ? ` (เก่ากว่า ${daysSince} วัน)` : ''}`
                : 'กำลังตรวจสอบข้อมูล...'
              }
            </p>
            <p className="mt-4 text-xs text-slate-500 leading-relaxed">
              เว็บไซต์นี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
              ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
            </p>
          </div>

          {/* Main links */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">เมนูหลัก</h3>
            <ul className="space-y-3">
              {[
                { href: '/funds',    label: 'ค้นหากองทุน' },
                { href: '/compare',  label: 'เปรียบเทียบกองทุน' },
                { href: '/rankings', label: 'จัดอันดับกองทุน' },
                { href: '/learn',    label: 'เรียนรู้' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info links */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">ข้อมูล</h3>
            <ul className="space-y-3">
              {[
                { href: '/methodology', label: 'วิธีคำนวณ' },
                { href: '/about',       label: 'เกี่ยวกับเรา' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://api.sec.or.th"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  SEC Open API ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} กองทุนไทย Research Dashboard · ข้อมูลจาก SEC Thailand
          </p>
          <p className="text-xs text-slate-600">
            ไม่เป็นคำแนะนำการลงทุน · ใช้เพื่อการศึกษาเท่านั้น
          </p>
        </div>
      </div>
    </footer>
  )
}
