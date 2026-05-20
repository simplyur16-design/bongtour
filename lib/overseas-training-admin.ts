import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'
import {
  parseTrainingAudience,
  parseTrainingCategory,
  type TrainingAudience,
  type TrainingCategory,
} from '@/lib/overseas-training-taxonomy'
import { ensureProductSlug } from '@/lib/product-slug'

export const trainingProgramAdminSelect = {
  id: true,
  slug: true,
  title: true,
  originalTitle: true,
  originUrl: true,
  originSource: true,
  originCode: true,
  registrationStatus: true,
  bgImageUrl: true,
  bgImageIsGenerated: true,
  bgImageSource: true,
  schedule: true,
  summary: true,
  trainingDescription: true,
  prepChecklistJson: true,
  fixedDepartureWeekday: true,
  durationDays: true,
  trainingCategory: true,
  trainingAudience: true,
  primaryDestination: true,
  destinationRaw: true,
  destination: true,
  createdAt: true,
  updatedAt: true,
} as const

export type TrainingProgramAdminRow = Prisma.ProductGetPayload<{ select: typeof trainingProgramAdminSelect }>

export function nextTrainingOriginCode(): string {
  return `OT-${Date.now().toString(36)}`
}

export type TrainingProgramWriteBody = {
  title?: string
  originalTitle?: string | null
  originUrl?: string | null
  registrationStatus?: string | null
  trainingDescription?: string | null
  prepChecklistJson?: string | null
  schedule?: string | null
  fixedDepartureWeekday?: number | null
  durationDays?: number | null
  trainingCategory?: string | null
  trainingAudience?: string | null
  destinationSummary?: string | null
  bgImageUrl?: string | null
  bgImageIsGenerated?: boolean
  /** JSON: airline, heroGallery[], imagePromptDraft (국외연수 전용) */
  summary?: string | null
}

export function parseTrainingProgramWriteBody(body: Record<string, unknown>): {
  data: TrainingProgramWriteBody
  errors: string[]
} {
  const errors: string[] = []
  const out: TrainingProgramWriteBody = {}

  if (body.title !== undefined) {
    const t = String(body.title).trim()
    if (!t) errors.push('title 필수')
    else out.title = t.slice(0, 280)
  }
  if (body.originalTitle !== undefined) {
    out.originalTitle =
      body.originalTitle == null || body.originalTitle === ''
        ? null
        : String(body.originalTitle).trim().slice(0, 500)
  }
  if (body.originUrl !== undefined) {
    out.originUrl =
      body.originUrl == null || body.originUrl === '' ? null : String(body.originUrl).trim().slice(0, 2000)
  }
  if (body.registrationStatus !== undefined) {
    const s = String(body.registrationStatus ?? '').trim()
    if (s && !['pending', 'registered', 'on_hold', 'rejected'].includes(s)) {
      errors.push('registrationStatus 유효하지 않음')
    } else out.registrationStatus = s || null
  }
  if (body.trainingDescription !== undefined) {
    out.trainingDescription =
      body.trainingDescription == null ? null : String(body.trainingDescription)
  }
  if (body.prepChecklistJson !== undefined) {
    out.prepChecklistJson =
      body.prepChecklistJson == null || body.prepChecklistJson === ''
        ? null
        : typeof body.prepChecklistJson === 'string'
          ? body.prepChecklistJson
          : JSON.stringify(body.prepChecklistJson)
  }
  if (body.schedule !== undefined) {
    out.schedule =
      body.schedule == null || body.schedule === ''
        ? null
        : typeof body.schedule === 'string'
          ? body.schedule
          : JSON.stringify(body.schedule)
  }
  if (body.fixedDepartureWeekday !== undefined) {
    const v = body.fixedDepartureWeekday
    if (v == null || v === '') out.fixedDepartureWeekday = null
    else {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0 || n > 6) errors.push('fixedDepartureWeekday 0-6')
      else out.fixedDepartureWeekday = n
    }
  }
  if (body.durationDays !== undefined) {
    const v = body.durationDays
    if (v == null || v === '') out.durationDays = null
    else {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1) errors.push('durationDays 1 이상')
      else out.durationDays = n
    }
  }
  if (body.trainingCategory !== undefined) {
    const raw = body.trainingCategory == null ? null : String(body.trainingCategory).trim()
    if (raw && !parseTrainingCategory(raw)) errors.push('trainingCategory 유효하지 않음')
    else out.trainingCategory = raw
  }
  if (body.trainingAudience !== undefined) {
    const raw = body.trainingAudience == null ? null : String(body.trainingAudience).trim()
    if (raw && !parseTrainingAudience(raw)) errors.push('trainingAudience 유효하지 않음')
    else out.trainingAudience = raw
  }
  if (body.destinationSummary !== undefined) {
    const d = body.destinationSummary == null ? null : String(body.destinationSummary).trim().slice(0, 200)
    out.destinationSummary = d
  }
  if (body.bgImageUrl !== undefined) {
    out.bgImageUrl = body.bgImageUrl == null || body.bgImageUrl === '' ? null : String(body.bgImageUrl).trim()
  }
  if (body.bgImageIsGenerated !== undefined) {
    out.bgImageIsGenerated = Boolean(body.bgImageIsGenerated)
  }
  if (body.summary !== undefined) {
    out.summary =
      body.summary == null || body.summary === '' ? null : String(body.summary)
  }

  return { data: out, errors }
}

export function prismaDataFromTrainingWrite(
  write: TrainingProgramWriteBody
): Prisma.ProductUpdateInput {
  const data: Prisma.ProductUpdateInput = {}
  if (write.title !== undefined) data.title = write.title
  if (write.originalTitle !== undefined) data.originalTitle = write.originalTitle
  if (write.originUrl !== undefined) data.originUrl = write.originUrl
  if (write.registrationStatus !== undefined) data.registrationStatus = write.registrationStatus
  if (write.trainingDescription !== undefined) data.trainingDescription = write.trainingDescription
  if (write.prepChecklistJson !== undefined) data.prepChecklistJson = write.prepChecklistJson
  if (write.schedule !== undefined) data.schedule = write.schedule
  if (write.fixedDepartureWeekday !== undefined) data.fixedDepartureWeekday = write.fixedDepartureWeekday
  if (write.durationDays !== undefined) data.durationDays = write.durationDays
  if (write.trainingCategory !== undefined) data.trainingCategory = write.trainingCategory
  if (write.trainingAudience !== undefined) data.trainingAudience = write.trainingAudience
  if (write.destinationSummary !== undefined) {
    data.primaryDestination = write.destinationSummary
    data.destinationRaw = write.destinationSummary
    data.destination = write.destinationSummary
  }
  if (write.bgImageUrl !== undefined) {
    data.bgImageUrl = write.bgImageUrl
    if (write.bgImageUrl) {
      data.bgImageSource = 'gemini_auto'
      data.bgImageSourceType = 'gemini'
    }
  }
  if (write.bgImageIsGenerated !== undefined) data.bgImageIsGenerated = write.bgImageIsGenerated
  if (write.summary !== undefined) data.summary = write.summary
  return data
}

export async function createTrainingProgram(body: Record<string, unknown>) {
  const { data: write, errors } = parseTrainingProgramWriteBody(body)
  if (!write.title) errors.push('title 필수')
  if (errors.length) return { ok: false as const, errors, product: null }

  const originCode = nextTrainingOriginCode()
  const patch = prismaDataFromTrainingWrite(write)
  const row = await prisma.product.create({
    data: {
      ...(patch as Omit<Prisma.ProductUncheckedCreateInput, 'originSource' | 'originCode' | 'listingKind'>),
      originSource: 'windsor',
      originCode,
      title: write.title!,
      originalTitle: write.originalTitle ?? write.title!,
      originUrl: write.originUrl ?? null,
      listingKind: OVERSEAS_TRAINING_LISTING_KIND,
      registrationStatus: write.registrationStatus ?? 'pending',
      priceFrom: null,
      productType: 'training',
      bgImageIsGenerated: write.bgImageIsGenerated ?? false,
    },
    select: trainingProgramAdminSelect,
  })

  await prisma.$transaction(async (tx) => {
    await ensureProductSlug(tx, row.id, {
      listingKind: OVERSEAS_TRAINING_LISTING_KIND,
      productType: 'training',
      originSource: 'windsor',
    })
  })

  const withSlug = await prisma.product.findUnique({
    where: { id: row.id },
    select: trainingProgramAdminSelect,
  })

  return { ok: true as const, errors: [], product: withSlug }
}

export async function updateTrainingProgram(id: string, body: Record<string, unknown>) {
  const existing = await prisma.product.findFirst({
    where: { id, listingKind: OVERSEAS_TRAINING_LISTING_KIND },
    select: { id: true },
  })
  if (!existing) return { ok: false as const, errors: ['프로그램을 찾을 수 없습니다.'], product: null }

  const { data: write, errors } = parseTrainingProgramWriteBody(body)
  if (errors.length) return { ok: false as const, errors, product: null }

  const product = await prisma.product.update({
    where: { id },
    data: prismaDataFromTrainingWrite(write),
    select: trainingProgramAdminSelect,
  })

  return { ok: true as const, errors: [], product }
}

export async function listTrainingProgramsAdmin() {
  return prisma.product.findMany({
    where: { listingKind: OVERSEAS_TRAINING_LISTING_KIND },
    select: trainingProgramAdminSelect,
    orderBy: [{ updatedAt: 'desc' }],
  })
}
