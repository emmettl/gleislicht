import MobileMapTools from './MobileMapTools.tsx'
import RoadCard from './RoadCard.tsx'
import AirOverviewCard from './AirOverviewCard.tsx'
import RoadOverviewCard from './RoadOverviewCard.tsx'
import PerformanceMonitor from './PerformanceMonitor.tsx'
import TrainCard from './TrainCard.tsx'
import type { ComponentProps } from 'react'
import AircraftCard from './AircraftCard.tsx'
import HubCard from './HubCard.tsx'
import ContrastCard from './ContrastCard.tsx'
import StationCard from './StationCard.tsx'
import RouteCard from './RouteCard.tsx'

type Props =
  | ({ kind: 'map-tools' } & ComponentProps<typeof MobileMapTools>)
  | ({ kind: 'RoadCard' } & ComponentProps<typeof RoadCard>)
  | ({ kind: 'AirOverviewCard' } & ComponentProps<typeof AirOverviewCard>)
  | ({ kind: 'RoadOverviewCard' } & ComponentProps<typeof RoadOverviewCard>)
  | ({ kind: 'TrainCard' } & ComponentProps<typeof TrainCard>)
  | { kind: 'performance' }
  | ({ kind: 'AircraftCard' } & ComponentProps<typeof AircraftCard>)
  | ({ kind: 'HubCard' } & ComponentProps<typeof HubCard>)
  | ({ kind: 'ContrastCard' } & ComponentProps<typeof ContrastCard>)
  | ({ kind: 'StationCard' } & ComponentProps<typeof StationCard>)
  | ({ kind: 'RouteCard' } & ComponentProps<typeof RouteCard>)

// One deferred chunk keeps selection details out of the opening map bundle.
export default function DetailCard(props: Props) {
  switch (props.kind) {
    case 'map-tools': return <MobileMapTools {...props} />
    case 'RoadCard': return <RoadCard {...props} />
    case 'AirOverviewCard': return <AirOverviewCard {...props} />
    case 'RoadOverviewCard': return <RoadOverviewCard {...props} />
    case 'TrainCard': return <TrainCard {...props} />
    case 'performance': return <PerformanceMonitor />
    case 'AircraftCard': return <AircraftCard {...props} />
    case 'HubCard': return <HubCard {...props} />
    case 'ContrastCard': return <ContrastCard {...props} />
    case 'StationCard': return <StationCard {...props} />
    case 'RouteCard': return <RouteCard {...props} />
  }
}
