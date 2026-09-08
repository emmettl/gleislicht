import copy
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('fr_sources', Path(__file__).with_name('prepare-fribourg-sources.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FribourgAcquisitionTest(unittest.TestCase):
    def setUp(self):
        self.page = {'spatialReference': {'wkid': 2056}, 'features': [
            {'attributes': {'OBJECTID': 1}, 'geometry': {'paths': [[[2570000, 1180000], [2571000, 1180000]]]}}
        ]}

    def test_missing_duplicate_and_truncated_pages_are_rejected(self):
        module.validate_page(self.page, [1])
        with self.assertRaises(AssertionError):
            module.validate_page(self.page, [1, 2])
        self.page['features'].append(copy.deepcopy(self.page['features'][0]))
        with self.assertRaises(AssertionError):
            module.validate_page(self.page, [1, 1])
        self.page['exceededTransferLimit'] = True
        with self.assertRaises(AssertionError):
            module.validate_page(self.page, [1])

    def test_reuse_requires_exact_dataset_terms_identity_and_geometry(self):
        root = Path(__file__).parent.parent / 'data/fribourg-sources'
        read = lambda name: json.loads((root / name).read_text())
        item, service, page = [read(name) for name in ['ogd-catalogue-item.json', 'ogd-service.json', 'ogd-lines.json']]
        lines = [{'properties': f['attributes'], 'geometry': {'coordinates': f['geometry']['paths']}}
                 for i in range(3) for f in read(f'lines-page-{i}.json')['features']]
        self.assertEqual(module.validate_reuse(item, service, page, lines)['matchedFeatures'], 128)
        for field, value in [('licenseInfo', 'Changed terms'), ('url', 'https://example.com'), ('access', 'private')]:
            changed = {**item, field: value}
            with self.assertRaises(AssertionError):
                module.validate_reuse(changed, service, page, lines)
        changed = copy.deepcopy(page)
        changed['features'][0]['geometry']['paths'][0][0][0] += 0.001
        with self.assertRaises(AssertionError):
            module.validate_reuse(item, service, changed, lines)
        changed = copy.deepcopy(page)
        changed['features'][0]['attributes']['ENTREPRISE_VALEUR'] = 'Other'
        with self.assertRaises(AssertionError):
            module.validate_reuse(item, service, changed, lines)

    def test_crs_coordinate_order_and_nonfinite_values_are_rejected(self):
        for point in [[1180000, 2570000], [7.1, 46.8], [float('nan'), 1180000]]:
            page = copy.deepcopy(self.page)
            page['features'][0]['geometry']['paths'][0][0] = point
            with self.assertRaises(AssertionError):
                module.validate_page(page, [1])
        self.page['spatialReference']['wkid'] = 4326
        with self.assertRaises(AssertionError):
            module.validate_page(self.page, [1])


if __name__ == '__main__':
    unittest.main()
