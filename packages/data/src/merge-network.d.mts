import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
export interface MergeOptions {
  retrievedAt?: string
  note?: string
  metadata?: Partial<NetworkSnapshot['metadata']>
  geometryMetadata?: Partial<NonNullable<NetworkSnapshot['metadata']['geometry']>>
}
export function mergeNetworkSnapshots(snapshots: readonly NetworkSnapshot[], options?: MergeOptions): NetworkSnapshot
