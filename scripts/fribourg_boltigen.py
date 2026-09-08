"""Decode retained hairpin roads and independently extract the exact Bern line from its original archive."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile


def decode(file):
    root = ET.fromstring(gzip.decompress(Path(file).read_bytes()))
    assert root.tag == 'osm' and root.get('version') == '0.6'
    def record(e):
        return {k: e.get(k) for k in ['id', 'version', 'timestamp']} | {'tags': {t.get('k'): t.get('v') for t in e.findall('tag')}}
    w = next(w for w in root.findall('way') if w.get('id') == '584938515')
    way = record(w) | {'nodes': [n.get('ref') for n in w.findall('nd')]}
    selected = set(way['nodes']) | {'437563544', '13418754224', '983973632'}
    nodes = [record(n) | {'coordinate': [float(n.get('lon')), float(n.get('lat'))]}
             for n in root.findall('node') if n.get('id') in selected]
    assert {n['id'] for n in nodes} == selected
    assert all(e['timestamp'] < '2026-09-04' for e in [way] + nodes)
    restrictions = [record(r) | {'members': [m.attrib for m in r.findall('member')]}
                    for r in root.findall('relation') if any(t.get('k') == 'type' and t.get('v') == 'restriction' for t in r.findall('tag'))]
    archive = Path('data/bern-sources/oevtp.gpkg.zip')
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == '4e2a4fcca08cc219c871d42c957753c09318ace2172fb3614c4fe71b20a4fe19'
    spec = importlib.util.spec_from_file_location('bern_source_decoder', 'scripts/prepare-bern-sources.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with zipfile.ZipFile(archive) as z, tempfile.TemporaryDirectory() as temp:
        db = Path(temp) / 'source.gpkg'; db.write_bytes(z.read('OEVTP.gpkg'))
        with sqlite3.connect(db) as c:
            count = c.execute('SELECT COUNT(*) FROM "geodb.oevtp_linie_vw"').fetchone()[0]
            records = module.rows(c, 'geodb.oevtp_linie_vw', "liniencode='20_259' AND tucode='TPF'")
            assert count == 518 and len(records) == 1
            feature = module.features(records, 'geometry')[0]
    return {'way': way, 'nodes': nodes, 'restrictions': restrictions, 'xmlBounds': root.find('bounds').attrib,
            'bernFeature': feature, 'bernLineInventory': {'total': count, 'selected': 1, 'excluded': count - 1}}


if __name__ == '__main__':
    print(json.dumps(decode(sys.argv[1]), ensure_ascii=False))
