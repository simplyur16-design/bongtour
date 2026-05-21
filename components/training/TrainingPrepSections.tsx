import {
  TRAINING_PUBLIC_BG,
  TRAINING_PUBLIC_BORDER,
  TRAINING_PUBLIC_TEXT,
} from '@/components/training/training-public-theme'

type Section = { title: string; items: string[] }

type Props = {
  sections: Section[]
  showEuropeDefaultNote?: boolean
}

export default function TrainingPrepSections({ sections, showEuropeDefaultNote }: Props) {
  if (sections.length === 0) {
    return <p className={TRAINING_PUBLIC_TEXT}>여행 준비·체크 사항을 준비 중입니다.</p>
  }

  return (
    <div className="space-y-6">
      {showEuropeDefaultNote ? (
        <p className={`rounded-lg border ${TRAINING_PUBLIC_BORDER} ${TRAINING_PUBLIC_BG} px-4 py-3 text-sm ${TRAINING_PUBLIC_TEXT}`}>
          유럽 연수 프로그램 공통 안내문입니다. 프로그램별로 다르게 보이게 하려면 관리자에서 여행준비 JSON을
          수정하세요.
        </p>
      ) : null}
      {sections.map((section) => (
        <section key={section.title} className={`border-b ${TRAINING_PUBLIC_BORDER} pb-6 last:border-b-0`}>
          <h3 className={`flex items-center gap-2 text-lg font-bold ${TRAINING_PUBLIC_TEXT}`}>
            <span className={TRAINING_PUBLIC_TEXT} aria-hidden>
              ✓
            </span>
            {section.title}
          </h3>
          <ul className={`mt-3 space-y-3 pl-1 text-[15px] leading-relaxed ${TRAINING_PUBLIC_TEXT}`}>
            {section.items.map((item, i) => (
              <li key={`${section.title}-${i}`} className="whitespace-pre-wrap">
                {item.startsWith('♠') ? item : `• ${item}`}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
