import type { ReactNode } from 'react'

type Props = {
  postProductSlot: ReactNode
}

/**
 * 해외여행 본문: 목적지 탐색·상품 목록은 상단 메가메뉴 + `/products` 로 이전.
 * 이전에 있던 로컬 탭·상세 조건 검색·갤러리형 상품 픽 섹션은 제거됨.
 */
export default function OverseasInteractiveShell({ postProductSlot }: Props) {
  return <div className="bg-bt-page">{postProductSlot}</div>
}
