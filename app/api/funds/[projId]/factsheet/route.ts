// app/api/funds/[projId]/factsheet/route.ts
// Redirect to SEC's PDF factsheet when available; otherwise show a friendly
// fallback instead of sending users to a broken blob URL.

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FACTSHEET_BASE = 'https://secdocumentstorage.blob.core.windows.net/fundfactsheet'

interface Props {
  params: Promise<{ projId: string }>
}

async function pdfExists(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'BulltiqFundDashboard/1.0' },
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { projId: rawProjId } = await params
  const projId = decodeURIComponent(rawProjId).trim()

  if (!/^M\d{4}_\d{4}$/i.test(projId)) {
    return NextResponse.json({ error: 'Invalid fund project id' }, { status: 400 })
  }

  const pdfUrl = `${FACTSHEET_BASE}/${encodeURIComponent(projId)}.pdf`
  if (await pdfExists(pdfUrl)) {
    return NextResponse.redirect(pdfUrl, 302)
  }

  const secSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:sec.or.th ${projId} Fund Fact Sheet`)}`
  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ไม่พบ Fund Fact Sheet — ${projId}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:40px 16px}
    main{max-width:620px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.06)}
    h1{font-size:22px;margin:0 0 12px} p{line-height:1.65;color:#475569} a{color:#1d4ed8;font-weight:600} .code{font-family:ui-monospace,Menlo,monospace;background:#f1f5f9;padding:2px 6px;border-radius:6px}
  </style>
</head>
<body>
  <main>
    <h1>ยังไม่พบ Fund Fact Sheet ของกองทุนนี้</h1>
    <p>ระบบลองเปิดไฟล์ PDF ของ ก.ล.ต. สำหรับรหัส <span class="code">${projId}</span> แล้ว แต่ไฟล์นี้ยังไม่มีอยู่ในคลัง PDF สาธารณะ</p>
    <p>อาจเกิดกับกองทุนเก่า กองทุนที่เปลี่ยนชื่อ/รวมกองทุน หรือไฟล์ยังไม่ถูกเผยแพร่ในรูปแบบ PDF โดยตรง</p>
    <p><a href="${secSearchUrl}" rel="noopener noreferrer">ค้นหาเอกสารของกองทุนนี้บนเว็บไซต์ ก.ล.ต.</a></p>
  </main>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
