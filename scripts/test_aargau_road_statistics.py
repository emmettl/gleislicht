import csv
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from aargau_road_statistics import ROOT, SOURCE_DIR, build, normalize, number, verified_body


class AargauStatisticsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with zipfile.ZipFile(SOURCE_DIR / 'aargau-export.zip') as archive:
            name = next(name for name in archive.namelist() if name.endswith('.csv'))
            cls.raw = list(csv.DictReader(io.StringIO(archive.read(name).decode('utf-8-sig')), delimiter=';'))
        cls.reviews = json.loads((ROOT / 'data/aargau-road-statistics-reviews.json').read_text())['reports']

    def test_build_reproduces_artifacts_and_accounts_for_every_row(self):
        with tempfile.TemporaryDirectory() as directory:
            audit = build(Path(directory))
            for name in ['aargau-road-statistics.json.gz', 'aargau-road-statistics-audit.json']:
                self.assertEqual((Path(directory) / name).read_bytes(), (ROOT / 'data' / name).read_bytes())
        self.assertEqual(audit['sourceRows'], audit['importedMivRows'] + audit['excludedCycleRows'])
        self.assertEqual((audit['importedMivRows'], audit['stations']), (10093, 911))
        self.assertEqual(audit['periodStatus'], {'available': 4868, 'missing': 5222, 'invalid': 3})
        self.assertEqual(audit['qualityStatus']['report-reviewed-with-substitution'], 3)
        self.assertFalse(audit['metadata']['playbackEligible'])
        self.assertFalse(audit['metadata']['publicDisplayAdmitted'])

    def test_annual_estimate_period_mean_and_coordinates_stay_distinct(self):
        row = normalize(self.raw[0], 2, self.reviews)
        self.assertEqual(row['metrics']['DTV'], 7473)
        self.assertEqual(row['metrics']['DTV24'], 7832)
        self.assertNotEqual(row['coordinates']['counter'], row['coordinates']['measurement'])
        self.assertEqual(row['period']['endExclusiveLocal'], '2026-05-14T00:00:00')
        self.assertEqual(row['sourceFields'], self.raw[0])

    def test_missing_is_not_zero_and_fractional_statistics_survive(self):
        self.assertIsNone(number(''))
        self.assertEqual(number('0.0'), 0)
        self.assertEqual(number('85.9'), 85.9)
        for value in ['-1', 'NaN', 'Infinity', 'bad']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                number(value)

    def test_missing_period_does_not_become_a_full_reference_year(self):
        source = next(row for row in self.raw if row['ZSTART'] == 'MIV' and not row['VON'])
        row = normalize(source, 2, self.reviews)
        self.assertIsNone(row['period']['startLocal'])
        self.assertIsNone(row['period']['endExclusiveLocal'])
        self.assertEqual(row['period']['status'], 'missing')
        self.assertEqual(row['referenceYear'], int(source['JAHR']))
        self.assertEqual(row['quality']['status'], 'report-unreviewed')

    def test_zero_length_period_is_flagged_and_preserved(self):
        source = next(row for row in self.raw if row['ZSTART'] == 'MIV' and row['VON'] and row['VON'] == row['BIS'])
        row = normalize(source, 2, self.reviews)
        self.assertEqual(row['stationId'], 'ZH1390')
        self.assertEqual(row['period']['status'], 'invalid')
        self.assertIn('invalid-survey-period', row['quality']['issues'])

    def test_report_substitution_follows_both_directions_without_aggregation(self):
        sources = [row for row in self.raw if row['DBLATT'] == '20260430_I_1000.pdf']
        records = [normalize(row, i + 2, self.reviews) for i, row in enumerate(sources)]
        self.assertEqual({row['direction']['scope'] for row in records}, {'both', '1', '2'})
        self.assertEqual(len({row['id'] for row in records}), 3)
        self.assertTrue(all('holiday-data-substitution' in row['quality']['issues'] for row in records))
        with self.assertRaisesRegex(ValueError, 'does not match'):
            normalize({**sources[0], 'ZSTID': 'OTHER'}, 2, self.reviews)

    def test_content_identity_ignores_export_row_order(self):
        self.assertEqual(normalize(self.raw[0], 2, self.reviews)['id'], normalize(self.raw[0], 99, self.reviews)['id'])
        self.assertNotEqual(normalize(self.raw[0], 2, self.reviews)['id'], normalize({**self.raw[0], 'JAHR': '2025'}, 2, self.reviews)['id'])

    def test_unknown_codes_and_incomplete_coordinates_fail(self):
        for changes in [{'R': 'new'}, {'AKTUELLP': ''}, {'ZSTART': 'Velo'}, {'ZST_N': ''}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                normalize({**self.raw[0], **changes}, 2, self.reviews)

    def test_corrupt_source_hash_fails(self):
        manifest = json.loads((SOURCE_DIR / 'manifest.json').read_text())
        next(entry for entry in manifest['sources'] if entry['path'] == 'aargau-export.zip')['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'integrity failure'):
            verified_body('aargau-export.zip', manifest)


if __name__ == '__main__':
    unittest.main()
