import Link from 'next/link'

type Props = {
  title: string
  description?: string
}

export default function MypagePageHeading({ title, description }: Props) {
  return (
    <div className="mb-6">
      <Link
        href="/mypage"
        className="text-sm font-medium text-[#534AB7] hover:text-[#1F1B2D]"
      >
        ← 마이페이지
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-[#1F1B2D]">{title}</h1>
      {description ? (
        <p className="mt-2 text-[15px] leading-relaxed text-[#534AB7]/90">{description}</p>
      ) : null}
    </div>
  )
}
