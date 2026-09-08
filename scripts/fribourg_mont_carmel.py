"""Decode the exact reviewed objects and every returned turn restriction from retained OSM XML."""
import gzip
import json
import sys
import xml.etree.ElementTree as ET


def decode(data):
    root = ET.fromstring(data)
    assert root.tag == 'osm' and root.get('version') == '0.6'
    def record(element):
        return {key: element.get(key) for key in ['id', 'version', 'timestamp']} | {
            'tags': {t.get('k'): t.get('v') for t in element.findall('tag')}}
    ways = []
    for element in root.findall('way'):
        if element.get('id') in ['1097802067', '55700630', '1095950865']:
            ways.append(record(element) | {'nodes': [n.get('ref') for n in element.findall('nd')]})
    selected = {n for w in ways for n in w['nodes']}
    nodes = [record(n) | {'coordinate': [float(n.get('lon')), float(n.get('lat'))]}
             for n in root.findall('node') if n.get('id') in selected]
    restrictions, relations = [], []
    for r in root.findall('relation'):
        item = record(r) | {'members': [m.attrib for m in r.findall('member')]}
        if item['tags'].get('type') == 'restriction':
            restrictions.append(item)
        elif r.get('id') in ['1224330', '2464722', '12589724', '12589725']:
            relations.append(item)
    return {'ways': ways, 'nodes': nodes, 'restrictions': restrictions, 'relations': relations,
            'xmlBounds': root.find('bounds').attrib,
            'scope': 'Three reviewed road ways and their complete nodes; all restrictions returned by the bbox API; four route-3 relations are stop-identity evidence only, with stale j23 GTFS tags.'}


if __name__ == '__main__':
    with gzip.open(sys.argv[1], 'rb') as source:
        print(json.dumps(decode(source.read()), ensure_ascii=False))
