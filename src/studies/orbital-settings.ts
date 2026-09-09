export type TerrainDetail = 'standard' | 'detailed'
const TERRAIN_DETAIL_KEY = 'gleislicht-orbital-terrain-detail'

export function readTerrainDetail(): TerrainDetail {
  try { return localStorage.getItem(TERRAIN_DETAIL_KEY) === 'detailed' ? 'detailed' : 'standard' }
  catch { return 'standard' }
}

export function saveTerrainDetail(detail: TerrainDetail) {
  try { localStorage.setItem(TERRAIN_DETAIL_KEY, detail) }
  catch { /* Terrain selection still works when browser storage is unavailable. */ }
}
