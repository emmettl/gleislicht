from pathlib import Path
import tempfile
import unittest
from compile_aargau_road_statistics import ROOT, build


class PublicStatisticsTest(unittest.TestCase):
    def test_public_assets_are_reproducible_and_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            index = build(Path(directory))
            expected = ROOT / 'public/data/aargau-road-statistics'
            self.assertEqual({p.name for p in expected.iterdir()}, {p.name for p in Path(directory).iterdir()})
            for path in Path(directory).iterdir():
                self.assertEqual(path.read_bytes(), (expected / path.name).read_bytes())
            self.assertEqual(sum(s['records'] for s in index['stations']), 10093)
            self.assertEqual(len(index['files']), 16)
            self.assertTrue(all(f['bytes'] < 750_000 for f in index['files'].values()))
            self.assertFalse(index['playbackEligible'])


if __name__ == '__main__':
    unittest.main()
