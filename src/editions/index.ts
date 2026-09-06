import { SWITZERLAND_EDITION } from './switzerland.ts'
import { LONDON_EDITION } from './london.ts'
import { NEW_YORK_EDITION } from './new-york.ts'
import { PARIS_EDITION } from './paris.ts'

export const EDITIONS = {
  switzerland: SWITZERLAND_EDITION,
  london: LONDON_EDITION,
  'new-york': NEW_YORK_EDITION,
  paris: PARIS_EDITION,
} as const

export type EditionId = keyof typeof EDITIONS
export type RegisteredEdition = (typeof EDITIONS)[EditionId]

export function resolveEdition(id?: string): RegisteredEdition {
  if (!id) return SWITZERLAND_EDITION
  if (id in EDITIONS) return EDITIONS[id as EditionId]
  throw new Error(`Unknown Motion Studies edition: ${id}`)
}
