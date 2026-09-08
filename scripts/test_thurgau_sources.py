import gzip
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('thurgau', Path(__file__).with_name('prepare-thurgau-sources.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ThurgauSources(unittest.TestCase):
    def setUp(self):
        self.body = gzip.decompress(Path('data/thurgau-sources/buslinie.gml.gz').read_bytes())

    def test_complete_original_vertex_decode(self):
        features, header = module.decode_gml(self.body)
        self.assertEqual(len(features), 337)
        self.assertEqual(features[0]['geometry']['coordinates'][0], [2698522.837, 1280874.879])
        self.assertEqual(header['numberMatched'], '337')

    def test_truncated_export_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'Truncated'):
            module.decode_gml(self.body.replace(b'numberMatched="337"', b'numberMatched="338"'))

    def test_wrong_crs_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'CRS'):
            module.decode_gml(self.body.replace(b'EPSG::2056', b'EPSG::4326'))

    def test_swapped_axes_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'axes'):
            module.decode_gml(self.body.replace(b'2698522.837000 1280874.879000', b'1280874.879000 2698522.837000'))

    def test_duplicate_feature_ids_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'Duplicate'):
            module.decode_gml(self.body.replace(b'gml:id="buslinie.2165"', b'gml:id="buslinie.2036"'))


if __name__ == '__main__':
    unittest.main()
