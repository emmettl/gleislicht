"""Decode the retained Portalban street corridor without routing or simplifying it."""
import gzip
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET


def decode(file):
    root = ET.fromstring(gzip.decompress(Path(file).read_bytes()))
    assert root.tag == 'osm' and root.get('version') == '0.6'
    def record(e):
        return {k: e.get(k) for k in ['id', 'version', 'timestamp']} | {'tags': {t.get('k'): t.get('v') for t in e.findall('tag')}}
    selected = {'43121098', '464228790', '1433895409'}
    ways = [record(w) | {'nodes': [n.get('ref') for n in w.findall('nd')]} for w in root.findall('way') if w.get('id') in selected]
    assert {w['id'] for w in ways} == selected
    ids = {n for w in ways for n in w['nodes']} | {'983847684', '10888130498'}
    nodes = [record(n) | {'coordinate': [float(n.get('lon')), float(n.get('lat'))]} for n in root.findall('node') if n.get('id') in ids]
    assert {n['id'] for n in nodes} == ids
    assert all(e['timestamp'] < '2026-09-04' for e in ways + nodes)
    restrictions = [record(r) | {'members': [m.attrib for m in r.findall('member')]} for r in root.findall('relation')
                    if any(t.get('k') == 'type' and t.get('v') == 'restriction' for t in r.findall('tag'))]
    return {'ways': ways, 'nodes': nodes, 'restrictions': restrictions, 'xmlBounds': root.find('bounds').attrib}


if __name__ == '__main__':
    print(json.dumps(decode(sys.argv[1]), ensure_ascii=False))
