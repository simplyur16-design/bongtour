'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeHubHybridCardOperationsPanel } from '@/components/admin/home-hub/HomeHubHybridCardOperationsPanel'
import { HomeHubImageGeneratorPanel } from '@/components/admin/home-hub/HomeHubImageGeneratorPanel'
import { HomeHubImageCandidateGrid } from '@/components/admin/home-hub/HomeHubImageCandidateGrid'
import { HomeHubWorkspaceBanner } from '@/components/admin/home-hub/HomeHubWorkspaceBanner'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import type { HomeHubActiveClientModel } from '@/lib/home-hub-active-client-model'
import { homeHubActiveFileToClientModel } from '@/lib/home-hub-active-client-model'
import type { HomeHubActiveFile } from '@/lib/home-hub-resolve-images'
import type { PrivateTripHeroSlidesFile } from '@/lib/private-trip-hero-types'
import { PrivateTripHeroSlidesPanel } from '@/components/admin/home-hub/PrivateTripHeroSlidesPanel'

const CARD_LABEL: Record<HomeHubCardImageKey, string> = {
  overseas: '해외여행',
  training: '국외연수',
  domestic: '국내여행',
  bus: '전세버스',
}

type Props = {
  initialActive: HomeHubActiveClientModel | null
  initialTravelPoolPreview: { overseas: string | null; domestic: string | null }
  initialPrivateTripHeroFile: PrivateTripHeroSlidesFile | null
}

export function HomeHubCardImagesWorkspace({
  initialActive,
  initialTravelPoolPreview,
  initialPrivateTripHeroFile,
}: Props) {
  const router = useRouter()
  const [active, setActive] = useState<HomeHubActiveClientModel | null>(() => initialActive)
  const [refreshToken, setRefreshToken] = useState(0)
  const [banner, setBanner] = useState<{ variant: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setActive(initialActive)
  }, [initialActive])

  const bump = useCallback(() => setRefreshToken((n) => n + 1), [])

  const dismissBanner = useCallback(() => setBanner(null), [])

  const onActivated = useCallback(
    (next: HomeHubActiveClientModel) => {
      setActive(next)
      setBanner({
        variant: 'success',
        message:
          '메인 허브 활성 JSON이 갱신되었습니다. 상단 요약·아래 4장 요약·갤러리의 “메인 적용” 표시가 같은 URL을 가리키는지 확인하세요. 메인 탭에서 실제 화면을 열어보려면 「메인 페이지에서 확인」을 누르세요.',
      })
      router.refresh()
    },
    [router]
  )

  const onActivateError = useCallback((message: string) => {
    setBanner({ variant: 'error', message })
  }, [])

  const onCandidateDeleted = useCallback(() => {
    bump()
    router.refresh()
  }, [bump, router])

  const onHybridSaved = useCallback(
    (file: HomeHubActiveFile) => {
      setActive(homeHubActiveFileToClientModel(file))
      setBanner({
        variant: 'success',
        message: '홈 허브 활성 JSON이 저장되었습니다. 아래 미리보기는 메인과 동일 규칙으로 갱신되었습니다.',
      })
      router.refresh()
    },
    [router],
  )

  return (
    <div className="space-y-8">
      {banner ? (
        <HomeHubWorkspaceBanner
          variant={banner.variant}
          message={banner.message}
          onDismiss={dismissBanner}
        />
      ) : null}
      <HomeHubImageGeneratorPanel onGenerated={bump} />
      <HomeHubImageCandidateGrid
        refreshToken={refreshToken}
        cardLabels={CARD_LABEL}
        mainImages={active?.images}
        onActivated={onActivated}
        onActivateError={onActivateError}
        onCandidateDeleted={onCandidateDeleted}
      />
      <HomeHubHybridCardOperationsPanel
        cardLabels={CARD_LABEL}
        active={active}
        initialTravelPool={initialTravelPoolPreview}
        onSaved={onHybridSaved}
        onSaveError={onActivateError}
      />

      <PrivateTripHeroSlidesPanel initialFile={initialPrivateTripHeroFile} />
    </div>
  )
}
