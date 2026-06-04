'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, Menu, X, Heart, ChevronDown, UserCheck, Wrench } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navLinks = [
  { href: '/funds',    label: 'กองทุน' },
  { href: '/movers',   label: 'วันนี้' },
  { href: '/rankings', label: 'จัดอันดับ' },
  { href: '/insights', label: 'Insights' },
  { href: '/heatmap',  label: 'Heatmap' },
  { href: '/amcs',     label: 'บลจ.' },
]

const toolLinks = [
  { href: '/screener',               label: 'Screener' },
  { href: '/tools/rmf-ssf',          label: 'คำนวณภาษี RMF/SSF' },
  { href: '/tools/simulate',         label: 'จำลองการลงทุน' },
  { href: '/tools/deposit-compare',  label: 'กองทุน vs เงินฝาก' },
  { href: '/tools/twin',             label: 'กองทุนฝาแฝด' },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement>(null)

  const isToolsActive = pathname?.startsWith('/screener') || pathname?.startsWith('/tools/')

  // Close tools dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openQuiz = () => window.dispatchEvent(new Event('open-quiz'))

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-blue-700">
          <TrendingUp className="h-6 w-6" />
          <span className="text-lg">กองทุนไทย</span>
          <span className="hidden text-sm font-normal text-slate-400 sm:inline">Research Dashboard</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-5 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-blue-700',
                pathname?.startsWith(link.href) ? 'text-blue-700' : 'text-slate-600'
              )}
            >
              {link.label}
            </Link>
          ))}

          {/* เครื่องมือ dropdown */}
          <div className="relative" ref={toolsRef}>
            <button
              onClick={() => setToolsOpen((v) => !v)}
              className={cn(
                'flex items-center gap-1 text-sm font-medium transition-colors hover:text-blue-700',
                isToolsActive ? 'text-blue-700' : 'text-slate-600'
              )}
            >
              <Wrench className="h-3.5 w-3.5" />
              เครื่องมือ
              <ChevronDown className={cn('h-3 w-3 transition-transform', toolsOpen && 'rotate-180')} />
            </button>
            {toolsOpen && (
              <div className="absolute left-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50">
                {toolLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setToolsOpen(false)}
                    className={cn(
                      'block px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 hover:text-blue-700',
                      pathname?.startsWith(link.href) ? 'text-blue-700 font-medium bg-blue-50' : 'text-slate-700'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={openQuiz}
            title="โปรไฟล์นักลงทุน"
            className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-blue-700"
          >
            <UserCheck className="h-4 w-4" />
          </button>
          <Link href="/watchlist" className={cn('flex items-center gap-1 text-sm transition-colors hover:text-red-500', pathname === '/watchlist' ? 'text-red-500' : 'text-slate-500')}>
            <Heart className="h-4 w-4" />
            ติดตาม
          </Link>
          <Link href="/compare">
            <Button size="sm">เปรียบเทียบ</Button>
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50',
                  pathname?.startsWith(link.href) ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Tools section */}
            <div className="mt-2 mb-1 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              เครื่องมือ
            </div>
            {toolLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-50',
                  pathname?.startsWith(link.href) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-2 border-t border-slate-100 pt-2 flex flex-col gap-1">
              <Link
                href="/watchlist"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 flex items-center gap-2"
              >
                <Heart className="h-4 w-4 text-red-400" /> รายการติดตาม
              </Link>
              <button
                onClick={() => { setMobileOpen(false); openQuiz() }}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 flex items-center gap-2 text-left"
              >
                <UserCheck className="h-4 w-4 text-blue-400" /> โปรไฟล์นักลงทุน
              </button>
              <Link
                href="/about"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-500"
              >
                เกี่ยวกับ
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
