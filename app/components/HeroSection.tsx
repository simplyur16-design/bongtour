'use client'

import { motion } from 'framer-motion'

type Props = { loadingDone: boolean }

export default function HeroSection({ loadingDone }: Props) {
  return (
    <motion.section
      className="rounded-2xl border border-bong-orange/20 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10 md:px-10 md:py-12"
      initial={{ opacity: 0, y: 16 }}
      animate={loadingDone ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <p className="text-center text-lg font-medium text-gray-800 sm:text-xl">
        우리는 낚시 가격을 올리지 않습니다.
      </p>
      <p className="mt-3 text-center text-2xl font-bold text-bong-orange sm:text-3xl md:text-4xl">
        Bong투어만의{' '}
        <span className="underline decoration-bong-orange/50 underline-offset-4">
          정직한 가격 보증
        </span>
      </p>
      <p className="mx-auto mt-4 max-w-xl text-center text-sm text-gray-600 sm:text-base">
        숨겨진 추가 비용 없이, 표시된 가격 그대로. 신뢰할 수 있는 여행만 추천합니다.
      </p>
    </motion.section>
  )
}
