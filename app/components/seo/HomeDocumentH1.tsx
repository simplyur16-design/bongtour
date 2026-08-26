import { HOME_PAGE_H1 } from '@/lib/home-page-metadata'

/** 검색엔진용 H1. 화면·레이아웃은 바꾸지 않는다. */
export default function HomeDocumentH1() {
  return <h1 className="sr-only">{HOME_PAGE_H1}</h1>
}
