import { describe, expect, it } from 'vitest'
import { ADDITIONAL_REGION_IDS, additionalRegionDate, additionalRegionKey } from './additional-regions.ts'
import { additionalRegionCopy } from './additional-regions-copy.tsx'
import { readStudyLink, REGIONAL_DAYS, STUDY_IDS } from './explore.ts'
import { SWITZERLAND_EDITION } from '../editions/switzerland.ts'
import { studyLinkUrl } from './share-link.ts'
import { EXPLORE_COPY } from './explore-copy.ts'

describe('additional archival regional studies', () => {
  for (const id of ADDITIONAL_REGION_IDS) {
    it(`${id} defaults to full day and preserves a Sunday morning share`, () => {
      expect(readStudyLink(`?study=${id}`).range).toBe('day')
      const url = studyLinkUrl('https://example.test/', { study: id, range: 'morning', date: '2026-09-06', time: 27900, station: 'Bahnhof' })
      expect(readStudyLink(new URL(url).search)).toMatchObject({ study: id, range: 'morning', date: '2026-09-06', time: 27900, station: 'Bahnhof' })
      expect(REGIONAL_DAYS[id]).toBe(`${additionalRegionKey(id)}/${id}-day-manifest.json`)
      expect(SWITZERLAND_EDITION.data.regional[id]).toBe(`${additionalRegionKey(id)}/${id}-morning.json`)
      expect(additionalRegionKey(id, '2026-09-06')).toContain('/2026-09-06/study')
    })
    it(`${id} has matching browser and runtime labels in all languages`, () => {
      for (const language of ['en', 'de', 'fr', 'it'] as const) {
        const copy = additionalRegionCopy(language, id), index = STUDY_IDS.indexOf(id)
        expect(EXPLORE_COPY[language].names[index]).toBe(copy.name)
        expect(EXPLORE_COPY[language].descriptions[index]).toBe(copy.modes)
        expect(copy.scope.length).toBeGreaterThan(20)
      }
    })
  }
  it('selects only reviewed fixture dates, leaving link mismatch disclosure to the application', () => {
    expect(additionalRegionDate('2026-10-01')).toBe('2026-09-04')
    expect(readStudyLink('?study=zug-region&date=2026-10-01').date).toBe('2026-10-01')
  })
})
