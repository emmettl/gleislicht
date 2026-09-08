import { ingestMountainTerrain } from './ingest-jungfrau-terrain.mjs'
import { mappedGornergratRoutes } from './gornergrat-terrain-geometry.mjs'
await ingestMountainTerrain('gornergrat',mappedGornergratRoutes,{columns:193,budgetKiB:120})
