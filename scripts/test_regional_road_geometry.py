import copy
import gzip
import json
import math
from pathlib import Path
import unittest

from regional_road_geometry import (RoadIndex, build_geometry, join_thurgau_classes,
                                    match_counter, verified_sources)

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT/'data/regional-road-geometry-sources/2026-09-08'
ORIGIN = [2680000, 1240000]


def point(x, y):
    return [ORIGIN[0]+x, ORIGIN[1]+y]


def path(identity, coords, **options):
    points = [point(*p) for p in coords]
    length = sum(math.dist(a, b) for a, b in zip(points, points[1:]))
    return {'id': identity, 'source': 'thurgau', 'roadKey': 'H14', 'name': 'Teststrasse',
            'roadClass': '1', 'eligibleClass': True, 'points': points, 'lengthMetres': length,
            'chainageStart': 0, 'chainageEnd': length, **options}


def detector(**options):
    return {'source': 'thurgau', 'scope': 'unreviewed', 'name': 'Teststrasse',
            'details': {'road': 'H14'}, **options}


class MatchingTests(unittest.TestCase):
    def test_named_axis_is_candidate_without_inventing_direction(self):
        result = match_counter(detector(), point(40, 3), RoadIndex([path('axis', [(0, 0), (100, 0)])]), {}, {})
        self.assertEqual(result['status'], 'axis-candidate')
        self.assertEqual(result['best']['distanceMetres'], 3)
        self.assertEqual(result['directionStatus'], 'unresolved')

    def test_parallel_alignments_of_same_road_compete(self):
        roads = [path('a', [(0, 0), (100, 0)]), path('b', [(0, 6), (100, 6)])]
        self.assertEqual(match_counter(detector(), point(40, 1), RoadIndex(roads), {}, {})['status'], 'ambiguous-axis')

    def test_shared_endpoint_only_coalesces_a_continuous_alignment(self):
        roads = [path('a', [(0, 0), (50, 0)]), path('b', [(50, 0), (100, 0)])]
        self.assertEqual(match_counter(detector(), point(50, 1), RoadIndex(roads), {}, {})['status'], 'axis-candidate')
        roads.append(path('branch', [(50, 0), (50, 80)]))
        self.assertEqual(match_counter(detector(), point(50, 1), RoadIndex(roads), {}, {})['status'], 'ambiguous-axis')

    def test_hairpin_is_not_collapsed_by_road_identity(self):
        roads = [path('loop', [(0, 0), (100, 0), (100, 6), (0, 6)])]
        self.assertEqual(match_counter(detector(), point(20, 1), RoadIndex(roads), {}, {})['status'], 'ambiguous-axis')

    def test_excluded_axis_is_not_bypassed_for_a_nearby_road(self):
        roads = [path('motorway', [(0, 0), (100, 0)], eligibleClass=False), path('local', [(0, 20), (100, 20)])]
        self.assertEqual(match_counter(detector(), point(40, 1), RoadIndex(roads), {}, {})['status'], 'excluded-axis-class')

    def test_scope_distance_and_label_gates(self):
        index = RoadIndex([path('axis', [(0, 0), (100, 0)])])
        self.assertEqual(match_counter(detector(scope='parking-access-candidate'), point(40, 1), index, {}, {})['status'], 'excluded-counter-scope')
        self.assertEqual(match_counter(detector(), point(40, 36), index, {}, {})['status'], 'axis-too-distant')
        self.assertEqual(match_counter(detector(), point(40, 101), index, {}, {})['status'], 'no-axis-within-100m')
        self.assertEqual(match_counter(detector(details={'road': 'K7'}), point(40, 1), index, {}, {})['status'], 'road-label-conflict-or-missing')

    def test_municipal_motor_modes_and_oneway_are_separate_evidence(self):
        index = RoadIndex([path('zh', [(0, 0), (100, 0)], source='zurich-city', roadKey='120')])
        d = detector(source='zurich-city', details={'road': 'Teststrasse'})
        event = {'messwert_von': 0, 'messwert_bis': 100, 'miv_vorhanden': 'ja'}
        one_way = {'messwert_von': 0, 'messwert_bis': 100, 'einbahnregime_technical': 'TF'}
        result = match_counter(d, point(50, 1), index, {'120': [event]}, {'teststrasse': [one_way]})
        self.assertEqual(result['status'], 'axis-candidate')
        self.assertEqual(result['events']['oneWay'], [one_way])
        self.assertEqual(result['directionStatus'], 'unresolved')
        result = match_counter(d, point(50, 1), index, {'120': [event, {**event, 'miv_vorhanden': 'nein'}]}, {})
        self.assertEqual(result['status'], 'motor-traffic-unconfirmed')


class ClassFamilyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _, cls.data, _ = verified_sources(SNAPSHOT)

    def one_row(self, **changes):
        key = 'thurgau-classes-2026-09-04'
        row = {**self.data[key][0], **changes}
        return {key: [row], key+'-count': {'total_count': 1}}

    def test_standalone_classes_do_not_require_or_fabricate_a_total(self):
        summary, rows, detectors = join_thurgau_classes(self.one_row(), [], ['2026-09-04'], 2026)
        self.assertEqual((summary['standaloneRows'], summary['joinedRows']), (1, 0))
        self.assertEqual(rows[0]['countBasis'], 'sum-of-published-classes')
        self.assertEqual(rows[0]['classSum'], sum(rows[0]['classes'].values()))
        self.assertIsNone(rows[0]['totalSourceRow'])
        self.assertTrue(detectors[0]['id'].startswith('thurgau-classes:'))
        _, _, access_detectors = join_thurgau_classes(self.one_row(name='Parkhaus Passage'), [], ['2026-09-04'], 2026)
        self.assertEqual(access_detectors[0]['scope'], 'parking-access-candidate')

    def test_class_total_conflict_is_reported_without_aggregation(self):
        data = self.one_row()
        _, rows, _ = join_thurgau_classes(data, [], ['2026-09-04'], 2026)
        r = rows[0]
        total = {'detectorId': r['detectorId'].replace('thurgau-classes:', 'thurgau:'), 'start': r['start'],
                 'count': r['classSum']+1, 'sourceRow': {'file': 'total.json.gz', 'index': 1}}
        summary, rows, _ = join_thurgau_classes(data, [total], ['2026-09-04'], 2026)
        self.assertEqual(summary['matchingTotals'], 0)
        self.assertIn('class-total-mismatch', rows[0]['issues'])

    def test_missing_class_and_wrong_interval_are_not_usable(self):
        _, rows, _ = join_thurgau_classes(self.one_row(pw=None, zeit_bis='15:00'), [], ['2026-09-04'], 2026)
        self.assertIsNone(rows[0]['classSum'])
        self.assertIn('inconsistent-class-hour-end', rows[0]['issues'])
        self.assertIn('invalid-or-missing-class-count', rows[0]['issues'])


class GeometrySnapshotTests(unittest.TestCase):
    def test_offline_reproduction_and_admission_gates(self):
        counter_audit = json.loads((ROOT/'data/regional-road-count-audit.json').read_bytes())
        counts = json.loads(gzip.decompress((ROOT/'data/regional-road-counts.json.gz').read_bytes()))
        artifact, audit = build_geometry(SNAPSHOT, counter_audit, counts)
        self.assertEqual(artifact, json.loads(gzip.decompress((ROOT/'data/regional-road-geometry.json.gz').read_bytes())))
        self.assertEqual(audit, json.loads((ROOT/'data/regional-road-geometry-audit.json').read_bytes()))
        self.assertEqual(len(audit['counters']), 620)
        self.assertEqual(audit['thurgauClasses']['standaloneRows'], 5760)
        self.assertTrue(all(not row['playbackEligible'] for row in audit['counters']))
        self.assertEqual(audit['municipalInventory']['status'], {'joined': 193, 'coordinate-conflict': 24})

    def test_incompatible_count_dates_fail(self):
        counter_audit = json.loads((ROOT/'data/regional-road-count-audit.json').read_bytes())
        counts = json.loads(gzip.decompress((ROOT/'data/regional-road-counts.json.gz').read_bytes()))
        counter_audit = copy.deepcopy(counter_audit)
        counter_audit['metadata']['dates'] = ['2025-09-04']
        with self.assertRaisesRegex(ValueError, 'Incompatible'):
            build_geometry(SNAPSHOT, counter_audit, counts)


if __name__ == '__main__':
    unittest.main()
