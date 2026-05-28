'use client'

import { useState, useEffect } from 'react'
import { QuizModal } from '@/components/onboarding/quiz-modal'
import { getProfile } from '@/lib/investor-profile'

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [quizOpen, setQuizOpen] = useState(false)

  useEffect(() => {
    if (!getProfile()) setQuizOpen(true)

    const handler = () => setQuizOpen(true)
    window.addEventListener('open-quiz', handler)
    return () => window.removeEventListener('open-quiz', handler)
  }, [])

  return (
    <>
      {children}
      <QuizModal open={quizOpen} onClose={() => setQuizOpen(false)} />
    </>
  )
}
