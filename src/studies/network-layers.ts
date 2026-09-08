import type { NetworkSnapshot } from '@motionstudies/core/domain/network'

/** Preserve the clock and geographic bounds for independently rendered layers. */
export function networkWithRailVisibility(snapshot: NetworkSnapshot, visible: boolean): NetworkSnapshot {
  return visible ? snapshot : {
    ...snapshot,
    stops: [],
    edges: [],
    paths: [],
    edgePaths: [],
    trains: [],
  }
}
