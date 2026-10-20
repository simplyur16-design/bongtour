/**
 * Ocean Warm 홈 목업 — 항공+호텔 정적 샘플 (P1 draft-local).
 * browse API는 승인(P4) 전까지 연결하지 않음.
 */

const AIR_CARDS = [
  {
    t: '다낭 항공+호텔 4일',
    s: '베트남 · 자유여행',
    p: '729,000원~',
    img: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
    href: '/travel/air-hotel',
  },
  {
    t: '오키나와 항공+호텔 3일',
    s: '일본 · 자유여행',
    p: '980,000원~',
    img: 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg?auto=compress&cs=tinysrgb&w=800',
    href: '/travel/air-hotel',
  },
  {
    t: '방콕 항공+호텔 5일',
    s: '태국 · 자유여행',
    p: '859,000원~',
    img: 'https://images.pexels.com/photos/1031659/pexels-photo-1031659.jpeg?auto=compress&cs=tinysrgb&w=800',
    href: '/travel/air-hotel',
  },
] as const

export default function OceanWarmAirHotelCards() {
  return (
    <div className="ow-air-block">
      <ul className="ow-cards ow-cards-air">
        {AIR_CARDS.map((c) => (
          <li key={c.t}>
            <a className="ow-card" href={c.href}>
              <div
                className="ow-card-media"
                style={{ backgroundImage: `url(${c.img})` }}
                role="img"
                aria-label={c.t}
              />
              <div className="ow-card-meta">
                <strong>{c.t}</strong>
                <span>{c.s}</span>
                <em>{c.p}</em>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <div className="ow-section-cta">
        <a className="ow-btn-primary" href="/travel/air-hotel">
          자유여행 보기
        </a>
      </div>
    </div>
  )
}
