import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('road_download', Path(__file__).with_name('download-postbus-road-source.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Response(io.BytesIO):
    def __init__(self, data, length=None):
        super().__init__(data)
        self.headers = {} if length is None else {'Content-Length': str(length)}

    def geturl(self):
        return 'https://download.geofabrik.de/europe/switzerland-260929.osm.pbf/'


class RoadDownloadTests(unittest.TestCase):
    def test_resolves_dated_extract_from_bounded_provider_state(self):
        state = b'# provider state\ntimestamp=2026-09-29T20\\:22\\:51Z\n'
        with patch.object(module.urllib.request, 'urlopen', return_value=Response(state)) as request:
            self.assertEqual(module.dated_source_url('https://download.geofabrik.de/europe/switzerland-latest.osm.pbf'),
                             'https://download.geofabrik.de/europe/switzerland-260929.osm.pbf')
        self.assertTrue(request.call_args[0][0].full_url.endswith('-updates/state.txt'))
        for state in [b'no timestamp', b'x' * 4097, b'timestamp=2026-99-99T00']:
            with patch.object(module.urllib.request, 'urlopen', return_value=Response(state)):
                with self.assertRaises(ValueError):
                    module.dated_source_url('https://example.test/region-latest.osm.pbf')

    def test_source_receipt_and_atomic_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'source.pbf'
            target.write_bytes(b'previous')
            with patch.object(module.urllib.request, 'urlopen', return_value=Response(b'new', 3)):
                receipt = module.download('https://example.test/source', target)
            self.assertEqual(target.read_bytes(), b'new')
            self.assertEqual(receipt['bytes'], 3)
            self.assertEqual(len(receipt['sha256']), 64)
            self.assertTrue(receipt['resolvedUrl'].endswith('260929.osm.pbf/'))
            self.assertFalse(target.with_suffix('.pbf.part').exists())

    def test_oversize_empty_and_truncated_responses_preserve_existing_file(self):
        for data, length, limit in [(b'abc', 3, 2), (b'abc', None, 2), (b'', None, 10), (b'ab', 3, 10)]:
            with self.subTest(data=data, length=length, limit=limit), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / 'source.pbf'
                target.write_bytes(b'previous')
                with patch.object(module.urllib.request, 'urlopen', return_value=Response(data, length)):
                    with self.assertRaises(ValueError):
                        module.download('https://example.test/source', target, max_bytes=limit, attempts=1)
                self.assertEqual(target.read_bytes(), b'previous')
                self.assertEqual(list(Path(directory).iterdir()), [target])

    def test_retries_transient_failure_without_unbounded_requests(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(module.urllib.request, 'urlopen', side_effect=[OSError('temporary'), Response(b'ok', 2)]) as request:
                with patch.object(module.time, 'sleep'):
                    module.download('https://example.test/source', Path(directory) / 'source.pbf')
            self.assertEqual(request.call_count, 2)
            with patch.object(module.urllib.request, 'urlopen', side_effect=OSError('offline')) as request:
                with patch.object(module.time, 'sleep'), self.assertRaises(OSError):
                    module.download('https://example.test/source', Path(directory) / 'source.pbf')
            self.assertEqual(request.call_count, 3)

    def test_total_download_deadline(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(module.urllib.request, 'urlopen', return_value=Response(b'abc')):
                with patch.object(module.time, 'monotonic', side_effect=[0, 601]):
                    with self.assertRaises(TimeoutError):
                        module.download('https://example.test/source', Path(directory) / 'source.pbf', attempts=1)
            self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
