import { SWITZERLAND_EDITION } from './switzerland.ts'

export const EDITIONS = {
  switzerland: SWITZERLAND_EDITION,
} as const

export type EditionId = keyof typeof EDITIONS
export type RegisteredEdition = (typeof EDITIONS)[EditionId]

export function resolveEdition(id?: string): RegisteredEdition {
  if (!id) return SWITZERLAND_EDITION
  if (id in EDITIONS) return EDITIONS[id as EditionId]
  throw new Error(`Unknown Gleislicht edition: ${id}`)
}

export const ACTIVE_EDITION = resolveEdition(
  import.meta.env.VITE_GLEISLICHT_EDITION?.trim(),
)
