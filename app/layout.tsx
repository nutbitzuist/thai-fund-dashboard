import type { Metadata } from 'next'
import { Noto_Sans_Thai, Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'กองทุนไทย Research Dashboard — ค้นหาและเปรียบเทียบกองทุนรวมไทย',
    template: '%s | กองทุนไทย Research Dashboard',
  },
  description:
    'แพลตฟอร์มค้นหาข้อมูลกองทุนรวมไทย เปรียบเทียบผลตอบแทน ทำความเข้าใจความเสี่ยง และจัดอันดับกองทุนเพื่อการศึกษา ข้อมูลจาก SEC Thailand',
  keywords: ['กองทุนรวม', 'mutual fund', 'กองทุนไทย', 'NAV', 'เปรียบเทียบกองทุน', 'SEC Thailand'],
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    siteName: 'กองทุนไทย Research Dashboard',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="th"
      className={`${notoSansThai.variable} ${inter.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-slate-50"
        style={{ fontFamily: 'var(--font-noto-sans-thai), var(--font-inter), sans-serif' }}
      >
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
