#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

function distanceKilometres(firstLongitude, firstLatitude, secondLongitude, secondLatitude) {
  const averageLatitude = ((firstLatitude + secondLatitude) * Math.PI) / 360
  const east =
    (secondLongitude - firstLongitude) * 111.32 * Math.cos(averageLatitude)
  const north = (secondLatitude - firstLatitude) * 111.32
  return Math.hypot(east, north)
}

export function airportIdsForTrack(track, airports) {
  return airports
    .filter((airport) =>
      track.samples.some(
        ([, longitude, latitude, altitudeFeet]) =>
          altitudeFeet <= airport.maximumApproachAltitudeFeet &&
          distanceKilometres(
            longitude,
            latitude,
            airport.longitude,
            airport.latitude,
          ) <= airport.approachRadiusKilometres,
      ),
    )
    .map(({ id }) => id)
}

function withAirportIds(track, ids) {
  if (!ids?.length) {
    const { airportIds: _airportIds, ...unchanged } = track
    return unchanged
  }
  return { ...track, airportIds: ids }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value)}\n`)
}

async function enrichSnapshot(path, airports) {
  const snapshot = await readJson(path)
  const tracks = snapshot.tracks.map((track) =>
    withAirportIds(track, airportIdsForTrack(track, airports)),
  )
  await writeJson(path, { ...snapshot, tracks })
  return new Map(tracks.map((track) => [track.id, track.airportIds ?? []]))
}

async function enrichManifest(path, airports) {
  const manifest = await readJson(path)
  const directory = dirname(path)
  const chunks = await Promise.all(
    manifest.chunks.map(async (descriptor) => {
      const chunkPath = join(directory, descriptor.path)
      return [descriptor, chunkPath, await readJson(chunkPath)]
    }),
  )
  const associations = new Map()
  for (const [, , chunk] of chunks) {
    for (const track of chunk.tracks) {
      const current = associations.get(track.id) ?? new Set()
      airportIdsForTrack(track, airports).forEach((id) => current.add(id))
      associations.set(track.id, current)
    }
  }
  for (const [, chunkPath, chunk] of chunks) {
    await writeJson(chunkPath, {
      ...chunk,
      tracks: chunk.tracks.map((track) =>
        withAirportIds(track, [...(associations.get(track.id) ?? [])]),
      ),
    })
  }
  await writeJson(path, {
    ...manifest,
    aircraft: manifest.aircraft.map((track) =>
      withAirportIds(track, [...(associations.get(track.id) ?? [])]),
    ),
  })
  return associations
}

async function main() {
  const cataloguePath = process.argv[2] ?? 'fixtures/tfl/all-change-airports.json'
  const morningPath = process.argv[3] ?? 'public/data/all-change-air-morning.json'
  const manifestPath = process.argv[4] ?? 'public/data/all-change-air-day-manifest.json'
  const airports = await readJson(cataloguePath)
  const morning = await enrichSnapshot(morningPath, airports)
  const day = await enrichManifest(manifestPath, airports)
  const summarise = (associations) =>
    Object.fromEntries(
      airports.map((airport) => [
        airport.iata,
        [...associations.values()].filter((ids) =>
          ids instanceof Set ? ids.has(airport.id) : ids.includes(airport.id),
        ).length,
      ]),
    )
  console.log('Morning airport associations', summarise(morning))
  console.log('24-hour airport associations', summarise(day))
}

if (process.argv[1]?.endsWith('enrich-airport-associations.mjs')) {
  await main()
}
