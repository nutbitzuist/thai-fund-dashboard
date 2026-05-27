// app/not-found.tsx — 404 Page

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-7xl font-bold text-blue-700 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">ไม่พบหน้าที่ต้องการ</h2>
      <p className="text-slate-500 mb-8 max-w-sm">
        หน้านี้ไม่มีอยู่หรืออาจถูกลบไปแล้ว
        กรุณาตรวจสอบ URL หรือกลับไปยังหน้าหลัก
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button>กลับหน้าหลัก</Button>
        </Link>
        <Link href="/funds">
          <Button variant="outline">ค้นหากองทุน</Button>
        </Link>
      </div>
    </div>
  )
}
