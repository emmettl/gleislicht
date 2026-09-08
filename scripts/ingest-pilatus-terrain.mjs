import { ingestMountainTerrain } from './ingest-jungfrau-terrain.mjs'
import { mappedPilatusRoutes } from './pilatus-terrain-geometry.mjs'
await ingestMountainTerrain('pilatus',mappedPilatusRoutes,{columns:193,budgetKiB:120,evidencePath:'data/pilatus-journey-source.json'})
