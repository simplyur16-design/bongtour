import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import OgImagesManager from './OgImagesManager'

export default async function AdminOgImagesPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/og-images')

  const actorRole = (session.user as { role?: string | null }).role

  return <OgImagesManager actorRole={actorRole} />
}
