"""Reject incomplete or mistimed historical Laupen source restorations."""
import gzip
from pathlib import Path
import shutil
import tempfile
import unittest
from fribourg_laupen import decode

SOURCE = Path('data/fribourg-laupen-sources')


class LaupenHistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        for file in SOURCE.glob('*.osm'):
            shutil.copy(file, self.directory / file.name)
        self.data = gzip.decompress((SOURCE / 'map.osm.gz').read_bytes())

    def tearDown(self):
        self.temp.cleanup()

    def test_restore_both_deleted_nodes_and_pre_fixture_positions(self):
        result = decode(self.data, self.directory)
        self.assertEqual(len(result['temporalRestoration']), 6)
        self.assertTrue(all(x['selected']['timestamp'] < '2026-09-04' for x in result['temporalRestoration']))
        self.assertTrue(all(x['supersededAt'] > '2026-09-07' for x in result['temporalRestoration']))

    def test_reject_edit_between_fixture_dates(self):
        file = self.directory / 'node-2952325480-history.osm'
        file.write_text(file.read_text().replace('2026-09-07T09:43:26Z', '2026-09-05T09:43:26Z'))
        with self.assertRaises(AssertionError):
            decode(self.data, self.directory)

    def test_reject_post_fixture_way_version(self):
        file = self.directory / 'way-86162950-v10.osm'
        file.write_text(file.read_text().replace('2025-07-26T18:51:09Z', '2026-09-05T18:51:09Z'))
        with self.assertRaises(AssertionError):
            decode(self.data, self.directory)


if __name__ == '__main__':
    unittest.main()
