import { expect, it } from 'vitest'
import en from './en.ts'
import de from './de.ts'
import fr from './fr.ts'
import itText from './it.ts'
import { ORBITAL_COPY } from '../studies/orbital-copy.ts'
import { EXPLORE_COPY } from '../studies/explore-copy.ts'
import { sourceCredit } from '../i18n.ts'

function compare(reference: unknown, translated: unknown, path: string) {
  expect(typeof translated, path).toBe(typeof reference)
  if (typeof reference === 'string') {
    expect(String(translated).trim().length, path).toBeGreaterThan(0)
    expect(String(translated).match(/\{\w+\}/g)?.sort() ?? [], path).toEqual(reference.match(/\{\w+\}/g)?.sort() ?? [])
  } else if (reference && typeof reference === 'object') {
    expect(Object.keys(translated as object).sort(), path).toEqual(Object.keys(reference).sort())
    for (const [key, value] of Object.entries(reference)) compare(value, (translated as Record<string, unknown>)[key], `${path}.${key}`)
  }
}
it.each(['de', 'fr', 'it'] as const)('%s supplies every interface key and interpolation placeholder', language => {
  compare(en, { de, fr, it: itText }[language], 'interface')
  compare(ORBITAL_COPY.en, ORBITAL_COPY[language], 'orbital')
  compare(EXPLORE_COPY.en, EXPLORE_COPY[language], 'studies')
  const modules = import.meta.glob('../studies/*-copy.ts', { eager: true })
  for (const [file, exports] of Object.entries(modules)) {
    for (const [name, value] of Object.entries(exports as object)) {
      if (value && typeof value === 'object' && 'en' in value) {
        compare(value.en, (value as Record<string, unknown>)[language], `${file}.${name}`)
      }
    }
  }
})

it('uses singular forms for individual routes, calls, tracks and road sections', () => {
  for (const [text, expected] of [
    [en, ['1 route · 1 scheduled call', '1 scheduled track', '1 call today', '1 counter section']],
    [de, ['1 Linie · 1 fahrplanmässiger Halt', '1 geplantes Gleis', '1 Halt heute', '1 Zählabschnitt']],
    [fr, ['1 ligne · 1 arrêt planifié', '1 voie planifiée', '1 arrêt aujourd’hui', '1 tronçon de comptage']],
    [itText, ['1 linea · 1 fermata pianificata', '1 binario pianificato', '1 fermata oggi', '1 sezione di conteggio']],
  ] as const) {
    expect([text.routesAndCalls(1, 1), text.scheduledTracks(1), text.callsToday('1'), text.roadSections(1)]).toEqual(expected)
  }
})

it('localizes source wording while retaining product names and licence identifiers', () => {
  expect(sourceCredit('fr', 'FOT · FOEN · swissALTIRegio · © OpenStreetMap contributors · ODbL'))
    .toBe('OFT · OFEV · swissALTIRegio · © contributeurs OpenStreetMap · ODbL')
})
