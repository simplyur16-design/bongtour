/**
 * Pages Router 전용 폴백 — App Router만 쓰는 프로젝트에서도 Next가 에러 경로 로드 시
 * `pages/_error` 모듈을 요구하는 경우가 있어 최소 구현을 둔다(빌드 산출물 누락 MODULE_NOT_FOUND 완화).
 */
import type { NextPageContext } from 'next'

type Props = { statusCode: number }

function ErrorPage({ statusCode }: Props) {
  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 480 }}>
      <h1 style={{ fontSize: '1.25rem' }}>일시적인 오류</h1>
      <p style={{ marginTop: '0.75rem', color: '#444' }}>
        {statusCode === 404 ? '요청한 페이지를 찾을 수 없습니다.' : '서버에서 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
      </p>
      {statusCode ? <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>코드: {statusCode}</p> : null}
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): Props => {
  const statusCode = res ? res.statusCode : err?.statusCode ? err.statusCode : 404
  return { statusCode: statusCode ?? 500 }
}

export default ErrorPage
