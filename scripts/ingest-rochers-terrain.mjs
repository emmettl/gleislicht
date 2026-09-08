import { ingestMountainTerrain } from './ingest-jungfrau-terrain.mjs'
import { mappedRochersRoutes } from './rochers-terrain-geometry.mjs'
await ingestMountainTerrain('rochers',mappedRochersRoutes,{columns:257,budgetKiB:120,evidencePath:'data/rochers-journey-source.json'})
