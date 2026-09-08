import * as THREE from 'three'

type HubLine = THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>

/** Batch the hub's static two-vertex segments with identical materials.
 * Takes ownership of the source resources. Returned batches own the retained
 * materials, and are disposed by the renderer's existing cleanup effect.
 */
export function batchHubLines(lines: readonly HubLine[]): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>[] {
  const batches = new Map<string, { positions: number[]; material: THREE.LineBasicMaterial }>()
  const retained = new Set<THREE.LineBasicMaterial>()
  const materials = new Set<THREE.LineBasicMaterial>()
  for (const line of lines) {
    const { uuid: _uuid, metadata: _metadata, ...properties } = line.material.toJSON()
    const key = JSON.stringify([properties, line.material.color.toArray()])
    let batch = batches.get(key)
    if (!batch) {
      batch = { positions: [], material: line.material }
      batches.set(key, batch)
      retained.add(line.material)
    }
    const position = line.geometry.getAttribute('position')
    for (let index = 0; index < position.count; index++) {
      batch.positions.push(position.getX(index), position.getY(index), position.getZ(index))
    }
    line.geometry.dispose()
    materials.add(line.material)
  }
  for (const material of materials) if (!retained.has(material)) material.dispose()
  return [...batches.values()].map(({ positions, material }) => new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)), material,
  ))
}
