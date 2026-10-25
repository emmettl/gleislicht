import { SERVICE_COLORS } from '@motionstudies/core/theme'
import type { NetworkMapStyle } from '@motionstudies/three/scene-style'

const screenOffset = (height: number, comparisonIndex: number) => height / 2 + 4 + Math.max(0, comparisonIndex) * (height + 4)

/** Edition-owned palette and placement policies; the renderer owns geometry/lifetimes. */
export function gleislichtMapStyle(style?: NetworkMapStyle): NetworkMapStyle {
  return ({ ...style,
    coplanar: true,
    selectionMarkers: { stationMaxRadiusPixels: 10, trainMaxRadiusPixels: 3.5 },
    trainLabels: { ...style?.trainLabels, screenOffset },
    categoryColors: style?.categoryColors ?? SERVICE_COLORS,
    trailElevationOffset: 0,
    airports: { independent: true, labelRenderOrder: 30, fog: false },
    roads: {
      mainline: { color: '#a0a6b2', opacity: ({ selected, subdued }) => selected ? 0.25 : subdued ? 0.2 : 0.45, depthTest: false, toneMapped: false },
      connectors: { color: '#a0a6b2', opacity: ({ subdued }) => subdued ? 0.15 : 0.3, depthTest: false, toneMapped: false },
      selected: { color: '#a0a6b2', opacity: 0.65 },
    },
  })
}
