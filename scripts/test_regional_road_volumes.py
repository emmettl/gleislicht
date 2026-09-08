import copy
from datetime import datetime, timedelta
import json
from pathlib import Path
import tempfile
import unittest

from compile_regional_road_volumes import build, make_hours
from regional_road_counts import day_hours


def row(start, value=0, status='measured', issues=None):
    return {'start': start, 'serviceDate': '2026-09-04', 'count': value,
            'quality': {'status': status, 'validation': 'raw-current-year', 'sourceFlags': {}},
            'issues': issues or [], 'sourceRow': {'file': 'test', 'index': 0}}


class RegionalVolumesTest(unittest.TestCase):
    def test_reproduces_public_files_and_keeps_families_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            index = build(Path('.'), Path(directory))
            for file in ['index.json'] + [f['path'] for f in index['files']]:
                self.assertEqual((Path(directory)/file).read_bytes(), (Path('public/data/regional-road-volumes')/file).read_bytes())
        self.assertEqual(len(index['series']), 620)
        self.assertEqual(sum(s['orientation'] is not None for s in index['series']), 31)
        self.assertEqual(sum(s['measurementBasis'] == 'sum-of-published-classes' for s in index['series']), 120)
        self.assertFalse(index['metadata']['playbackEligible'])

    def test_measured_zero_is_not_absence(self):
        result = make_hours('2026-09-04', [row(day_hours('2026-09-04')[0])])
        self.assertEqual(result['hours'][0]['value'], 0)
        self.assertIsNone(result['hours'][1]['value'])
        self.assertEqual(result['hours'][1]['quality']['status'], 'absent')
        self.assertEqual(result['measuredSubtotal'], 0)
        self.assertIsNone(result['dayTotal'])

    def test_imputed_edited_and_flagged_values_are_retained_but_not_displayed(self):
        slots = day_hours('2026-09-04')
        rows = [row(slots[0], 21, 'imputed'), row(slots[1], 22, 'edited'), row(slots[2], 23, issues=['class-total-mismatch']), row(slots[3], None, 'missing')]
        result = make_hours('2026-09-04', rows)
        self.assertEqual([h['reportedValue'] for h in result['hours'][:4]], [21, 22, 23, None])
        self.assertTrue(all(h['value'] is None for h in result['hours']))
        self.assertEqual(result['hours'][3]['quality']['status'], 'missing')
        self.assertIsNone(result['measuredSubtotal'])

    def test_complete_day_total_and_class_sum_remain_explicit(self):
        rows = [row(start, 5) for start in day_hours('2026-09-04')]
        self.assertEqual(make_hours('2026-09-04', rows)['dayTotal'], 120)
        classes = copy.deepcopy(rows[0])
        del classes['count']
        classes.update(countBasis='sum-of-published-classes', classSum=17)
        self.assertEqual(make_hours('2026-09-04', [classes])['hours'][0]['value'], 17)

    def test_rejects_duplicate_counter_hours(self):
        observation = row(day_hours('2026-09-04')[0])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            make_hours('2026-09-04', [observation, observation])

    def test_rejects_wrong_dates_durations_and_non_counts(self):
        observation = row(day_hours('2026-09-04')[0])
        for extra, message in [({'serviceDate': '2026-09-06'}, 'civil date'), ({'intervalSeconds': 60}, 'Non-hourly'), ({'count': True}, 'Invalid normalized count'), ({'count': -1}, 'Invalid normalized count')]:
            with self.subTest(extra=extra), self.assertRaisesRegex(ValueError, message):
                make_hours('2026-09-04', [{**observation, **extra}])
        with self.assertRaisesRegex(ValueError, 'interval end'):
            make_hours('2026-09-04', [{**observation, 'end': (datetime.fromisoformat(observation['start'])+timedelta(minutes=30)).isoformat()}])

    def test_dst_days_preserve_23_and_25_distinct_utc_slots(self):
        for day, length in [('2026-03-29', 23), ('2026-10-25', 25)]:
            rows = [{**row(start, 1), 'serviceDate': day} for start in day_hours(day)]
            result = make_hours(day, rows)
            self.assertEqual(len(result['hours']), length)
            self.assertEqual(result['dayTotal'], length)

    def test_fixture_preserves_missing_sunday_and_missing_municipal_values(self):
        tg = json.loads(Path('public/data/regional-road-volumes/thurgau/2026-09-06.json').read_bytes())
        self.assertEqual(sum(h['quality']['status'] == 'absent' for s in tg['series'] for h in s['hours']), 144)
        zh = json.loads(Path('public/data/regional-road-volumes/zurich-city/2026-09-04.json').read_bytes())
        self.assertEqual(sum(h['quality']['status'] == 'missing' for s in zh['series'] for h in s['hours']), 168)


if __name__ == '__main__':
    unittest.main()
