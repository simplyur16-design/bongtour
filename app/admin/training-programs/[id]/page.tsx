export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import TrainingProgramAdminEditor from '@/app/admin/training-programs/TrainingProgramAdminEditor'
import { trainingProgramAdminSelect } from '@/lib/overseas-training-admin'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'
import { prisma } from '@/lib/prisma'

type Props = { params: Promise<{ id: string }> }

export default async function AdminTrainingProgramEditPage({ params }: Props) {
  const { id } = await params
  const product = await prisma.product.findFirst({
    where: { id, listingKind: OVERSEAS_TRAINING_LISTING_KIND },
    select: trainingProgramAdminSelect,
  })
  if (!product) notFound()

  return <TrainingProgramAdminEditor productId={id} initial={product} />
}
