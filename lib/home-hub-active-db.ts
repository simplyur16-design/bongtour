import { prisma } from '@/lib/prisma'

/**
 * 모바일 홈 타일 URL 등의 HUB 활성 설정을 DB에 영구 저장한다.
 *
 * 배경: 배포 전엔 `public/data/home-hub-active.json` 파일로만 관리했으나
 *   Railway는 컨테이너 파일시스템이 ephemeral이라 배포마다 git 커밋된 옛 값으로
 *   덮어써져 관리자가 저장한 URL이 사라지는 문제가 있었다.
 *
 * 이 모듈은 **영구 저장소**(DB) 역할이고, 런타임 읽기는 여전히 파일을 본다.
 * 부트 시 `home-hub-active-bootstrap.ts`가 DB → 파일 복원을 수행한다.
 *
 * 사용자 PII 아님 (공개 URL 뿐) → 암호화/마스킹 불필요.
 */

const SINGLETON_ID = 'singleton'

export type HomeHubActiveDbRecord = {
  id: string
  data: unknown
  updatedAt: Date
}

export async function fetchHomeHubActiveConfigRecord(): Promise<HomeHubActiveDbRecord | null> {
  try {
    const row = await prisma.homeHubActiveConfig.findUnique({
      where: { id: SINGLETON_ID },
    })
    return row
  } catch (e) {
    console.error('[home-hub-active-db] fetch failed:', e)
    return null
  }
}

/**
 * fire-and-forget 용. 호출자가 await 하지 않아도 에러는 로그로 남는다.
 * `writeHomeHubActiveMerged`에서 await로 호출한다.
 */
export async function upsertHomeHubActiveConfigRecord(data: unknown): Promise<void> {
  await prisma.homeHubActiveConfig.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      data: data as object,
    },
    update: {
      data: data as object,
    },
  })
}
