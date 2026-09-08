import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { gornergratAscents } from './gornergrat.ts'
import { bindMeasuredTerrain } from './measured-terrain.ts'
export function bindGornergratTerrain(value: unknown, network: NetworkSnapshot, train: NetworkSnapshot['trains'][number]) {
 if(!gornergratAscents(network).includes(train))return
 return bindMeasuredTerrain(value,network,{id:'gornergrat-ascent-terrain',allowOmittedStops:true,legs:[{train,departure:train.stops[0][2],arrival:train.stops.at(-1)![1],vehicle:'cogwheel'}]})
}
