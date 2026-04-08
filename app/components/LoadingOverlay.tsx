'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const WAIT_AFTER_BOTH = 1 // 두 줄 모두 나타난 후 대기(초)

export default function LoadingOverlay({ onComplete }: { onComplete: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const total = 1 + 0.5 + 1.2 + WAIT_AFTER_BOTH // 3.7초 (대기 1초)
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onComplete, 500)
    }, total * 1000)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-beige"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* 단계 1: 첫 번째 줄 — opacity 0→1, y 20→0, 1초 */}
          <motion.p
            className="font-medium text-loading-gray text-lg sm:text-xl"
            style={{ fontFamily: 'var(--font-noto-sans-kr)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            행복한 여행을 만드는
          </motion.p>

          {/* 단계 2: 0.5초 후 두 번째 줄 — scale 0.5→1.1→1, opacity 0→1, 1.2초 */}
          <motion.p
            className="font-bold text-bong-orange text-5xl tracking-tight sm:text-6xl"
            style={{ fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: [0.5, 1.1, 1],
            }}
            transition={{
              opacity: { duration: 1.2, delay: 0.5 },
              scale: {
                duration: 1.2,
                delay: 0.5,
                times: [0, 0.6, 1],
                ease: [0.25, 0.46, 0.45, 0.94],
              },
            }}
          >
            BongTour
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
