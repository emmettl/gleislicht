import { SWITZERLAND_EDITION } from './switzerland.ts'

export const EDITIONS = { switzerland: SWITZERLAND_EDITION } as const
export type EditionId = keyof typeof EDITIONS
export type RegisteredEdition = (typeof EDITIONS)[EditionId]

export function resolveEdition(id?: string): RegisteredEdition {
  if (!id || id === 'switzerland') return SWITZERLAND_EDITION
  throw new Error(`Unknown Gleislicht edition: ${id}`)
}
