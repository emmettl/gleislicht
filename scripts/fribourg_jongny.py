"""Decode pinned Jongny road/route objects and all returned turn restrictions."""
import gzip
import json
import sys
import xml.etree.ElementTree as ET

WAY_IDS = ['33834623', '26834441', '296774233', '353177811', '56058308', '26834440', '1320550996', '26834438', '1320550993', '1238158528']
RELATION_IDS = ['8291117', '8291116', '12495927']


def decode(data):
    root = ET.fromstring(data)
    assert root.tag == 'osm' and root.get('version') == '0.6'
    def record(e):
        return {k: e.get(k) for k in ['id', 'version', 'timestamp']} | {'tags': {t.get('k'): t.get('v') for t in e.findall('tag')}}
    ways = [record(w) | {'nodes': [n.get('ref') for n in w.findall('nd')]} for w in root.findall('way') if w.get('id') in WAY_IDS]
    selected = {n for w in ways for n in w['nodes']}
    nodes = [record(n) | {'coordinate': [float(n.get('lon')), float(n.get('lat'))]} for n in root.findall('node') if n.get('id') in selected]
    relations, restrictions = [], []
    for r in root.findall('relation'):
        item = record(r) | {'members': [m.attrib for m in r.findall('member')]}
        if item['tags'].get('type') == 'restriction': restrictions.append(item)
        elif r.get('id') in RELATION_IDS: relations.append(item)
    return {'ways': ways, 'nodes': nodes, 'relations': relations, 'restrictions': restrictions, 'xmlBounds': root.find('bounds').attrib}


if __name__ == '__main__':
    with gzip.open(sys.argv[1], 'rb') as f:
        print(json.dumps(decode(f.read()), ensure_ascii=False))
