import { it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkBaselGeometryRegression } from './check-basel-geometry-regression.mjs'

it('allows an explicit repair-bundle update without allowing timetable or accepted-path changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'basel-regression-'))
  const before = join(directory, 'before'), after = join(directory, 'after')
  const manifest = { stops: [[7.5, 47.5, 'A'], [7.6, 47.6, 'B'], [7.7, 47.7, 'C']], edges: [[0, 1], [1, 2]],
    paths: [[[7.5, 47.5], [7.6, 47.6]], [[7.6, 47.6], [7.7, 47.7]]], tripCount: 1, chunks: [{ path: 'chunk.json' }],
    metadata: { serviceDate: '2026-09-08', sourceHashes: { archive: 'same', reviewedGeometry: 'old' } } }
  const train = { id: 'a', route: '2', stops: [[0, 0, 0], [1, 60, 60], [2, 120, 120]], pathSegments: [0, null] }
  const write = async (dir, m, t) => {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'basel-core-day-manifest.json'), JSON.stringify(m))
    await writeFile(join(dir, 'chunk.json'), JSON.stringify({ trains: [t] }))
  }
  try {
    await write(before, manifest, train)
    const updated = structuredClone(manifest), repaired = { ...train, pathSegments: [0, 1] }
    updated.metadata.sourceHashes.reviewedGeometry = 'new'
    await write(after, updated, repaired)
    await expect(checkBaselGeometryRegression(before, after)).rejects.toThrow(/Original source changed/)
    const options = { allowReviewedGeometryUpdate: true }
    await expect(checkBaselGeometryRegression(before, after, options)).resolves.toMatchObject({ preservedAcceptedMovements: 1, addedMovements: 1, passed: true })
    updated.metadata.sourceHashes.archive = 'changed'
    await write(after, updated, repaired)
    await expect(checkBaselGeometryRegression(before, after, options)).rejects.toThrow(/Original source changed: archive/)
    updated.metadata.sourceHashes.archive = 'same'
    updated.paths[0][0][0] += .001
    await write(after, updated, repaired)
    await expect(checkBaselGeometryRegression(before, after, options)).rejects.toThrow(/Accepted path changed/)
    updated.paths = manifest.paths
    await write(after, updated, { ...repaired, stops: [[0, 0, 0], [1, 61, 61], [2, 120, 120]] })
    await expect(checkBaselGeometryRegression(before, after, options)).rejects.toThrow(/Source calls\/times\/boundaries changed/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
