/**
 * 국외연수(공공·기업) 검색용 구조화 데이터 + 메타.
 * REGRESSION-FREEZE[seo-training-og-jsonld]: /business·/business/programs·/business/programs/<slug> 페이지별 og·JSON-LD — manifest
 */
import type { Metadata } from 'next'
import { absoluteUrl, SITE_NAME, toAbsoluteImageUrl } from '@/lib/site-metadata'
import { COMPANY_FOOTER } from '@/lib/company-footer'
import {
  trainingProgramPublicPath,
  type TrainingProgramPublicRow,
} from '@/lib/overseas-training-program-query'

export const TRAINING_OG_IMAGE_PATH = '/og/training.webp'

/** 국외연수에서 실제로 하는 일 — 소개 문구·Service JSON-LD 공통 (요청서 A2) */
export const TRAINING_SERVICE_SCOPE = [
  '연수기관 섭외',
  '일정 기획',
  '제안서',
  '설명회',
  '지방의회·지자체 연수',
] as const

export const TRAINING_PROGRAMS_TITLE = `국외연수 프로그램 | ${SITE_NAME}`
export const TRAINING_PROGRAMS_DESCRIPTION =
  '지방의회·지자체·공공기관·기업 국외연수 프로그램. 연수기관 섭외, 일정 기획, 제안서, 설명회까지 진행하며 가격은 상담 후 안내합니다.'

type TrainingPick = Pick<
  TrainingProgramPublicRow,
  'id' | 'slug' | 'title' | 'bgImageUrl' | 'summary' | 'trainingDescription' | 'primaryDestination' | 'destination' | 'durationDays' | 'duration'
>

function providerNode(): Record<string, unknown> {
  return {
    '@type': 'TravelAgency',
    '@id': `${absoluteUrl('/').replace(/\/$/, '')}/#travelagency`,
    name: COMPANY_FOOTER.legalName,
    url: absoluteUrl('/'),
  }
}

function breadcrumb(items: Array<{ name: string; path?: string }>): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: absoluteUrl(it.path) } : {}),
    })),
  }
}

function plain(s: string | null | undefined, max = 200): string {
  const t = (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

export function trainingProgramDescription(p: TrainingPick): string {
  const dest = (p.primaryDestination ?? p.destination ?? '').trim()
  const lead = plain(p.summary) || plain(p.trainingDescription, 120)
  const base = `${p.title}${dest ? ` (${dest})` : ''} — 공공·기업 국외연수 프로그램.`
  return plain(`${base} ${lead ? `${lead} ` : ''}연수기관 섭외·일정 기획·제안서까지 상담 후 견적 안내.`, 300)
}

/** /business 허브 */
export function buildBusinessHubJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb([{ name: '홈', path: '/' }, { name: '국외연수·공공·기업', path: '/business' }]),
      {
        '@type': 'Service',
        '@id': `${absoluteUrl('/business')}#service`,
        name: '공공·기업 국외연수 기획·운영',
        serviceType: '국외연수',
        description:
          '지방의회·지자체·공공기관·기업 국외연수의 연수기관 섭외, 일정 기획, 제안서, 설명회와 현지 운영을 진행합니다.',
        url: absoluteUrl('/business'),
        areaServed: { '@type': 'Country', name: 'KR' },
        provider: providerNode(),
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: '국외연수 서비스',
          itemListElement: TRAINING_SERVICE_SCOPE.map((name) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name },
          })),
        },
      },
    ],
  }
}

/** /business/programs 목록 */
export function buildTrainingProgramsListJsonLd(programs: readonly TrainingPick[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb([
        { name: '홈', path: '/' },
        { name: '국외연수·공공·기업', path: '/business' },
        { name: '국외연수 프로그램', path: '/business/programs' },
      ]),
      {
        '@type': 'ItemList',
        '@id': `${absoluteUrl('/business/programs')}#programs`,
        name: '국외연수 프로그램',
        itemListElement: programs.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.title,
          url: absoluteUrl(trainingProgramPublicPath(p)),
        })),
      },
    ],
  }
}

/** /business/programs/<slug> 상세 — BreadcrumbList + TouristTrip(가격 없음) */
export function buildTrainingProgramJsonLd(p: TrainingPick): Record<string, unknown> {
  const path = trainingProgramPublicPath(p)
  const img = toAbsoluteImageUrl(p.bgImageUrl)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumb([
        { name: '홈', path: '/' },
        { name: '국외연수·공공·기업', path: '/business' },
        { name: '국외연수 프로그램', path: '/business/programs' },
        { name: p.title, path },
      ]),
      {
        '@type': 'TouristTrip',
        '@id': `${absoluteUrl(path)}#trip`,
        name: p.title,
        description: trainingProgramDescription(p),
        url: absoluteUrl(path),
        ...(img ? { image: img } : {}),
        touristType: ['지방의회·지자체 연수단', '공공기관 연수단', '기업 연수단'],
        provider: providerNode(),
      },
    ],
  }
}

export function buildTrainingProgramsListMetadata(): Metadata {
  return {
    title: { absolute: TRAINING_PROGRAMS_TITLE },
    description: TRAINING_PROGRAMS_DESCRIPTION,
    alternates: { canonical: '/business/programs' },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: TRAINING_PROGRAMS_TITLE,
      description: TRAINING_PROGRAMS_DESCRIPTION,
      url: '/business/programs',
      images: [{ url: TRAINING_OG_IMAGE_PATH, alt: '국외연수 프로그램' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: TRAINING_PROGRAMS_TITLE,
      description: TRAINING_PROGRAMS_DESCRIPTION,
      images: [TRAINING_OG_IMAGE_PATH],
    },
  }
}

export function buildTrainingProgramMetadata(p: TrainingPick): Metadata {
  const path = trainingProgramPublicPath(p)
  const title = `${p.title} | 국외연수 | ${SITE_NAME}`
  const description = trainingProgramDescription(p)
  const image = toAbsoluteImageUrl(p.bgImageUrl) ?? TRAINING_OG_IMAGE_PATH
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [{ url: image, alt: p.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

/** `<script type="application/ld+json">` 본문 — `</script>` 탈출 방지 */
export function jsonLdScriptHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
