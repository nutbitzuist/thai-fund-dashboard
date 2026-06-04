'use client'

// components/fund/share-fund-button.tsx
// Lightweight share/copy action for fund detail pages.

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShareFundButtonProps {
  abbr: string
  nameTh: string | null
  return1Y: number | null
  fundPageUrl: string
  compareUrl: string
  twinUrl: string
}

function formatReturn(value: number | null): string {
  if (value == null || Number.isNaN(value)) return 'N/A'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function ShareFundButton({
  abbr,
  nameTh,
  return1Y,
  fundPageUrl,
  compareUrl,
  twinUrl,
}: ShareFundButtonProps) {
  const [copied, setCopied] = useState(false)

  const text = [
    `${abbr}${nameTh ? ` — ${nameTh}` : ''}`,
    `ผลตอบแทน 1Y: ${formatReturn(return1Y)}`,
    fundPageUrl,
    `Compare: ${compareUrl}`,
    `Twin: ${twinUrl}`,
  ].join('\n')

  async function handleShare() {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: abbr, text, url: fundPageUrl })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      // User cancelled the native share sheet or clipboard is unavailable.
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Share2 className="h-4 w-4 mr-1.5" />}
      <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
      <span className="sm:hidden">{copied ? 'Copied' : 'Share'}</span>
    </Button>
  )
}
