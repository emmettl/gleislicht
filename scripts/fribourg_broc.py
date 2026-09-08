"""Read the reviewed one-way station road and adjacent context from retained OSM XML."""
import gzip
import json
import sys
import xml.etree.ElementTree as ET


def decode(data):
    root = ET.fromstring(data)
    assert root.tag == 'osm' and root.get('version') == '0.6'
    def record(e):
        return {k: e.get(k) for k in ['id', 'version', 'timestamp']} | {'tags': {t.get('k'): t.get('v') for t in e.findall('tag')}}
    ways = [record(w) | {'nodes': [n.get('ref') for n in w.findall('nd')]}
            for w in root.findall('way') if w.get('id') in ['1395561049', '324718738', '32890919']]
    assert len(ways) == 3
    selected = {n for w in ways for n in w['nodes']}
    nodes = [record(n) | {'coordinate': [float(n.get('lon')), float(n.get('lat'))]}
             for n in root.findall('node') if n.get('id') in selected]
    assert {n['id'] for n in nodes} == selected
    assert all(e['timestamp'] < '2026-09-04' for e in ways + nodes)
    restrictions = [record(r) | {'members': [m.attrib for m in r.findall('member')]}
                    for r in root.findall('relation') if any(t.get('k') == 'type' and t.get('v') == 'restriction' for t in r.findall('tag'))]
    return {'ways': ways, 'nodes': nodes, 'restrictions': restrictions, 'xmlBounds': root.find('bounds').attrib}


if __name__ == '__main__':
    with gzip.open(sys.argv[1], 'rb') as f:
        print(json.dumps(decode(f.read()), ensure_ascii=False))
