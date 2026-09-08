import copy
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from regional_road_counts import (TimeIssue, compile_snapshot, count, day_hours,
                                  normalize, read_snapshot, swiss_instant)

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/regional-road-sources/2026-09-08'
MANIFEST, FILES = read_snapshot(SNAPSHOT)
SAMPLES = {}
for entry, data in FILES:
    if entry['role'] == 'observations' and entry['source'] not in SAMPLES:
        SAMPLES[entry['source']] = data['result']['records'][0] if isinstance(data, dict) else data[0]


def observation(source, **changes):
    row = {**SAMPLES[source], **changes}
    return normalize(source, row, acquisition_year=2026)[1]


class HourlySemanticsTests(unittest.TestCase):
    def test_civil_day_lengths_and_utc_midnight(self):
        self.assertEqual([len(day_hours(d)) for d in ('2026-03-29', '2026-09-04', '2026-10-25')], [23, 24, 25])
        self.assertEqual(swiss_instant('2026-09-04T00:00:00').isoformat(), '2026-09-03T22:00:00+00:00')

    def test_unordered_autumn_fold_is_quarantined(self):
        with self.assertRaisesRegex(TimeIssue, 'ambiguous'):
            swiss_instant('2026-10-25T02:00:00')
        for source, fields in [('thurgau', {'datum': '2026-10-25', 'zeit_von': '02:00', 'zeit_bis': '03:00'}),
                               ('zurich-city', {'MessungDatZeit': '2026-10-25T02:00:00'})]:
            obs = observation(source, **fields)
            self.assertIsNone(obs['start'])
            self.assertIn('ambiguous-local-hour', obs['issues'])
            self.assertIsNotNone(obs['count'])

    def test_spring_gap_and_real_hour_crossing_gap(self):
        with self.assertRaisesRegex(TimeIssue, 'nonexistent'):
            swiss_instant('2026-03-29T02:00:00')
        obs = observation('thurgau', datum='2026-03-29', zeit_von='01:00', zeit_bis='03:00')
        self.assertEqual(obs['intervalSeconds'], 3600)
        self.assertEqual(obs['issues'], [])

    def test_explicit_utc_disambiguates_both_autumn_hours(self):
        hours = [observation('basel', datetimefrom=f'2026-10-25T0{i}:00:00+00:00',
                             datetimeto=f'2026-10-25T0{i+1}:00:00+00:00') for i in (0, 1)]
        self.assertNotEqual(hours[0]['start'], hours[1]['start'])
        self.assertEqual([h['intervalSeconds'] for h in hours], [3600, 3600])

    def test_bad_intervals_and_naive_basel_times(self):
        self.assertIn('non-hourly-interval', observation('basel', datetimefrom='2026-09-04T00:00:00Z', datetimeto='2026-09-04T02:00:00Z')['issues'])
        self.assertIn('missing-UTC-offset', observation('basel', datetimefrom='2026-09-04T00:00:00')['issues'])
        self.assertIn('inconsistent-hour-end', observation('thurgau', zeit_von='10:00', zeit_bis='12:00')['issues'])

    def test_zero_missing_invalid_and_imputed_are_distinct(self):
        self.assertEqual(observation('zurich-city', AnzFahrzeuge='0')['count'], 0)
        self.assertIsNone(observation('zurich-city', AnzFahrzeuge='', AnzFahrzeugeStatus='Fehlend')['count'])
        imputed = observation('zurich-city', AnzFahrzeuge='15', AnzFahrzeugeStatus='Imputiert')
        self.assertEqual((imputed['count'], imputed['quality']['status']), (15, 'imputed'))
        for invalid in (None, '', -1, 'oops', 'NaN', 'Inf', True, 1.2):
            self.assertIsNone(count(invalid))
        self.assertIn('missing-status-with-numeric-value', observation('zurich-city', AnzFahrzeuge='42', AnzFahrzeugeStatus='Fehlend')['issues'])
        self.assertIn('unknown-source-quality', observation('zurich-city', AnzFahrzeugeStatus='NEW')['issues'])

    def test_validation_flags_and_acquisition_year_are_preserved(self):
        obs = observation('basel', valuesapproved=0, valuesedited=1)
        self.assertEqual(obs['quality'], {'status': 'edited', 'validation': 'unapproved', 'sourceFlags': {'valuesapproved': 0, 'valuesedited': 1}})
        self.assertEqual(observation('thurgau')['quality']['validation'], 'raw-current-year')
        self.assertEqual(observation('thurgau', datum='2025-09-04')['quality']['validation'], 'completed-year-publisher-validated')

    def test_classes_and_named_lane_remain_separate(self):
        detector, obs = normalize('basel', {**SAMPLES['basel'], 'lanecode': None, 'lanename': 'Spur 1', 'pw0': None}, acquisition_year=2026)
        self.assertEqual(detector['details']['laneIdentityBasis'], 'name')
        self.assertIn('name%3ASpur%201', detector['id'])
        self.assertIsNone(obs['classes']['pw0'])
        self.assertIn('vehicle-class-total-mismatch', observation('basel', total=999999)['issues'])

    def test_municipal_identity_is_measurement_site_not_individual_loop(self):
        detector, obs = normalize('zurich-city', SAMPLES['zurich-city'], acquisition_year=2026)
        self.assertEqual(detector['id'], 'zurich-city:' + SAMPLES['zurich-city']['MSID'])
        self.assertIsNone(detector['lane'])
        self.assertTrue(8.4 < detector['coordinate'][0] < 8.7)
        self.assertFalse(any('speed' in key.lower() for key in obs))


class SnapshotTests(unittest.TestCase):
    def mutate_snapshot(self, role, source, mutate):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name)
        manifest = copy.deepcopy(MANIFEST)
        changed = False
        for entry, (_, original) in zip(manifest['files'], FILES):
            data = copy.deepcopy(original)
            if not changed and entry['role'] == role and entry['source'] == source:
                mutate(data)
                changed = True
            body = json.dumps(data).encode()
            entry['bytes'], entry['sha256'] = len(body), hashlib.sha256(body).hexdigest()
            (path / entry['path']).write_bytes(gzip.compress(body, mtime=0))
        (path / 'manifest.json').write_text(json.dumps(manifest))
        return path

    def test_snapshot_and_outputs_reproduce_offline(self):
        artifact, audit = compile_snapshot(SNAPSHOT, [Path('public/data/swiss-road-topology.json'), Path('data/zurich-cantonal-road-counters.json')])
        self.assertEqual(len(artifact['observations']), 23832)
        self.assertEqual(len(audit['detectors']), 500)
        self.assertEqual(audit['quarantinedRows'], [])
        self.assertEqual(artifact, json.loads(gzip.decompress((ROOT/'data/regional-road-counts.json.gz').read_bytes())))
        self.assertEqual(audit, json.loads((ROOT/'data/regional-road-count-audit.json').read_text()))
        self.assertTrue(all(not d['playbackEligible'] for d in audit['detectors']))
        self.assertEqual([d['absentHoursInUnion'] for d in audit['daily']], [0, 24, 0, 144, 0, 0])
        self.assertEqual(sum(d['scope'] == 'parking-access-candidate' for d in audit['detectors']), 2)

    def test_source_hash_tampering_fails(self):
        path = self.mutate_snapshot('metadata', 'basel', lambda _: None)
        entry = MANIFEST['files'][0]
        (path/entry['path']).write_bytes(gzip.compress(b'{}'))
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            read_snapshot(path)

    def test_incomplete_export_fails(self):
        path = self.mutate_snapshot('observations', 'thurgau', lambda rows: rows.pop())
        with self.assertRaisesRegex(ValueError, 'counts do not reconcile'):
            compile_snapshot(path)

    def test_conflicting_duplicates_fail(self):
        def change(rows):
            rows[1] = {**rows[0], 'total': rows[0]['total']+1}
        path = self.mutate_snapshot('observations', 'basel', change)
        with self.assertRaisesRegex(ValueError, 'Conflicting duplicate'):
            compile_snapshot(path)

    def test_out_of_window_observation_fails(self):
        path = self.mutate_snapshot('observations', 'basel', lambda rows: rows[0].update(datetimefrom='2026-01-01T00:00:00Z', datetimeto='2026-01-01T01:00:00Z'))
        with self.assertRaisesRegex(ValueError, 'outside requested'):
            compile_snapshot(path)


if __name__ == '__main__':
    unittest.main()
