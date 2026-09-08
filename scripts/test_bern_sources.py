import importlib.util
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location('bern_sources', Path(__file__).with_name('prepare-bern-sources.py'))
bern = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bern)


def blob(wkb):
    return b'GP\x00\x01' + struct.pack('<i', 2056) + wkb


def line(points, kind=2):
    return b'\x01' + struct.pack('<II', kind, len(points)) + b''.join(struct.pack('<' + 'd' * len(p), *p) for p in points)


class BernSourceTest(unittest.TestCase):
    def test_multiline_preserves_disconnected_parts(self):
        first = line([(2600000, 1200000), (2600100, 1200000)])
        second = line([(2601000, 1200000), (2601100, 1200000)])
        result = bern.decode(blob(b'\x01' + struct.pack('<II', 5, 2) + first + second))
        self.assertEqual(result['type'], 'MultiLineString')
        self.assertEqual(len(result['coordinates']), 2)
        self.assertNotEqual(result['coordinates'][0][-1], result['coordinates'][1][0])

    def test_3d_and_envelope(self):
        source = line([(2600000, 1200000, 500), (2600100, 1200000, 502)], 1002)
        header = b'GP\x00\x03' + struct.pack('<i', 2056) + struct.pack('<dddd', 2600000, 2600100, 1200000, 1200000)
        self.assertEqual(bern.decode(header + source)['coordinates'][0], [2600000, 1200000])

    def test_bad_crs_trailing_bytes_and_swapped_axes_fail(self):
        source = blob(line([(2600000, 1200000), (2600100, 1200000)]))
        with self.assertRaises(AssertionError):
            bern.decode(source + b'garbage')
        with self.assertRaises(AssertionError):
            bern.decode(source[:4] + struct.pack('<i', 4326) + source[8:])
        with self.assertRaises(AssertionError):
            bern.decode(blob(line([(1200000, 2600000), (1200100, 2600000)])))


if __name__ == '__main__':
    unittest.main()
