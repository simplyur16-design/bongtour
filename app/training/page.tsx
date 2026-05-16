import { permanentRedirect } from 'next/navigation'

/** 레거시 URL — `/business`로 영구 이동 (next.config 301과 병행). */
export default function TrainingPage() {
  permanentRedirect('/business')
}
