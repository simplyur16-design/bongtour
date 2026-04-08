import type { HomeHubCardImageKey } from '@/lib/home-hub-images'

export type HubImageSeasonKey = 'default' | 'spring' | 'summer' | 'autumn' | 'winter'

export type HomeHubCandidateRecord = {
  id: string
  cardKey: HomeHubCardImageKey
  season: string
  promptText: string
  promptVersion?: string
  imagePath: string
  imageWidth?: number
  imageHeight?: number
  generationProvider: 'gemini' | 'stub'
  isSelected: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  note?: string
}

export type HomeHubCandidatesFile = {
  candidates: HomeHubCandidateRecord[]
}
