import importlib.util
from pathlib import Path
import tempfile
import sqlite3
import unittest
import xml.etree.ElementTree as ET
import zipfile

spec = importlib.util.spec_from_file_location('zug', Path(__file__).with_name('prepare-zug-sources.py'))
zug = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zug)


class SourceTests(unittest.TestCase):
    def test_full_source_and_adversarial_wfs_responses(self):
        source = Path('data/zug-sources')
        with zipfile.ZipFile(source / 'buslinien.zip') as z, tempfile.TemporaryDirectory() as temp:
            db = Path(temp) / 'source.gpkg'
            db.write_bytes(z.read('geopackage/Buslinien.gpkg'))
            with sqlite3.connect(db) as c:
                features = zug.shared.features(zug.shared.rows(c, 'Buslinien'), 'geom')
        xml, hits = (source / 'wfs.gml').read_bytes(), (source / 'wfs-hits.xml').read_bytes()
        self.assertTrue(zug.reconcile(features, xml, hits)['equalWithinOneMillimetre'])
        root = ET.fromstring(xml)
        member = root.find('{http://www.opengis.net/gml}featureMember')
        root.remove(member)
        with self.assertRaisesRegex(AssertionError, 'Truncated'):
            zug.reconcile(features, ET.tostring(root), hits)
        root.append(root.find('{http://www.opengis.net/gml}featureMember'))
        with self.assertRaisesRegex(AssertionError, 'Duplicate'):
            zug.reconcile(features, ET.tostring(root), hits)
        root = ET.fromstring(xml)
        root.find('.//{http://www.qgis.org/gml}liniennummer').text = '999'
        with self.assertRaisesRegex(AssertionError, 'membership'):
            zug.reconcile(features, ET.tostring(root), hits)
        root = ET.fromstring(xml)
        pos = root.find('.//{http://www.opengis.net/gml}posList')
        values = pos.text.split(); values[0] = str(float(values[0]) + 1)
        pos.text = ' '.join(values)
        with self.assertRaisesRegex(AssertionError, 'millimetre'):
            zug.reconcile(features, ET.tostring(root), hits)


if __name__ == '__main__':
    unittest.main()
