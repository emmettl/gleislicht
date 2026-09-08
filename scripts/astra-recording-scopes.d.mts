import type { AstraSnapshot } from './astra-measured-data.mjs'
export type RecordingScope = 'a1-zurich' | 'national' | 'zurich-cantonal'
export interface CantonalCatalog {
  metadata: {
    supplier: string
    publisher: string
    recordingScope: string
    sourceSha256: string
    measurementSiteTableVersion: number
  }
  stations: readonly { id: string }[]
  detectors: readonly { id: string }[]
}
export const RECORDING_OUTPUTS: Record<RecordingScope, string>
export function validateRecordingScope(scope: string): RecordingScope
export function cantonalSiteReferences(catalog: CantonalCatalog): string[]
export function scopedRecordedSnapshot(snapshot: AstraSnapshot, scope: RecordingScope, siteReferences: readonly string[], catalog?: CantonalCatalog): AstraSnapshot
