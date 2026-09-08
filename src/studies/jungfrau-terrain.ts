import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { JungfrauAscent } from './jungfrau-ascent.ts'
import { bindMeasuredTerrain } from './measured-terrain.ts'
export { measuredTerrainPosition as jungfrauTerrainPosition, railPoint, railSamples } from './measured-terrain.ts'
export type { TerrainPoint, TerrainWindow, MeasuredTerrainRoute as JungfrauTerrainRoute, MeasuredTerrain as JungfrauTerrain, MeasuredTerrainBinding as JungfrauTerrainBinding } from './measured-terrain.ts'
export function bindJungfrauTerrain(value: unknown, network: NetworkSnapshot, sequence: JungfrauAscent) {
 if(sequence.legs.length!==3)return
 return bindMeasuredTerrain(value,network,{id:'jungfrau-ascent-terrain',legs:sequence.legs.map((leg,i)=>({...leg,vehicle:i===0?'train':'cogwheel'}))})
}
