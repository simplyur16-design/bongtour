import { redirect } from 'next/navigation'

/** ZIP 기능 제거됨 → WebP 변환 페이지로 이동 */
export default function ConvertToWebpZipPage() {
  redirect('/admin/convert-to-webp')
}
