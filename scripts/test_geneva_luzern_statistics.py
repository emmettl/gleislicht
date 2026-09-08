import gzip
import json
from pathlib import Path
import tempfile
import unittest
from compile_geneva_luzern_statistics import ROOT, SOURCES, body, build, geneva_record, number


class StatisticsTest(unittest.TestCase):
    def test_reproduces_assets_and_accounts_for_inventory_and_rounding(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'public'
            audit = build(output, Path(directory) / 'audit.json')
            for path in output.iterdir():
                self.assertEqual(path.read_bytes(), (ROOT / 'public/data/geneva-luzern-statistics' / path.name).read_bytes())
            self.assertEqual((Path(directory) / 'audit.json').read_bytes(), (ROOT / 'data/geneva-luzern-statistics-audit.json').read_bytes())
            self.assertEqual(audit['genevaPoints'], 694)
            self.assertEqual(audit['genevaDistinctSiredo'], 586)
            self.assertEqual(audit['genevaMissingDailyMeans'], 170)
            self.assertEqual(audit['luzernSeparatelyRoundedHours'], [4, 12, 15, 18, 21])

    def test_uses_measurement_point_identity_and_preserves_fractional_siredo(self):
        feature = json.loads(gzip.decompress((SOURCES / 'geneva-points.json.gz').read_bytes()))['features'][0]
        row = geneva_record(feature)
        self.assertEqual(row['id'], 'blcxvge15100r')
        self.assertEqual(row['siredo'], 2068.2)
        self.assertEqual(row['dailyMean'], {'value': 7910, 'referenceYear': 2025})
        self.assertIsNone(row['peakReferencePeriod'])
        self.assertNotIn('DATEDT', row)
        self.assertNotIn('ANGLE', row)

    def test_missing_and_zero_are_distinct_and_invalid_numbers_fail(self):
        self.assertIsNone(number(None))
        self.assertEqual(number(0), 0)
        for value in [True, -1, '3', float('nan')]:
            with self.assertRaises(ValueError): number(value)

    def test_report_values_are_not_replaced_with_direction_sums_or_daily_means(self):
        data = json.loads((ROOT / 'public/data/geneva-luzern-statistics/luzern.json').read_text())
        p = data['profile']
        self.assertEqual(p['hours']['QS'][4], 149)
        self.assertEqual(p['hours']['R1'][4] + p['hours']['R2'][4], 150)
        self.assertEqual(p['dailyMean'], 15207)
        self.assertNotEqual(sum(p['hours']['QS']), p['dailyMean'])
        self.assertEqual(data['catalogueDailyMean'], 15546)
        self.assertIsNone(data['catalogueReferenceYear'])
        self.assertFalse(data['playbackEligible'])

    def test_source_hash_mismatch_fails(self):
        manifest = json.loads((SOURCES / 'manifest.json').read_text())
        next(item for item in manifest['sources'] if item['path'] == 'geneva-points.json')['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'integrity'): body('geneva-points.json', manifest)


if __name__ == '__main__':
    unittest.main()
