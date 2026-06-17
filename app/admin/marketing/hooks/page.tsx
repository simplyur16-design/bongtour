import HookLibraryClient from '@/components/admin/marketing/hooks/HookLibraryClient'

export const dynamic = 'force-dynamic'

export default function HookLibraryPage() {
  return (
    <div className="mx-auto max-w-6xl p-4">
      <HookLibraryClient />
    </div>
  )
}
