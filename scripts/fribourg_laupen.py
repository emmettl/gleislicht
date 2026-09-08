"""Decode reviewed Laupen roads plus all bbox turn restrictions; retain original object metadata."""
import gzip
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

WAY_IDS = ['1003262061', '1218939917', '1218944698', '1218962118', '1218962505', '1218962506', '1311028295', '1311028296', '1311028303', '1328072093', '1417597462', '1531474220', '1531474222', '1531474223', '187800171', '28057895', '28058028', '315755631', '335414139', '543954973', '67409690', '83160711', '86162922', '86162950', '916903749', '916903750', '933369888', '933369889', '933369890']
EVIDENCE_NODES = ['308077071', '12135658380', '983847733', '1408214299', '11079574460']


def decode(data, directory):
    root = ET.fromstring(data)
    assert root.tag == 'osm' and root.get('version') == '0.6'
    def record(e):
        return {key: e.get(key) for key in ['id', 'version', 'timestamp']} | {
            'tags': {t.get('k'): t.get('v') for t in e.findall('tag')}}
    ways = [record(w) | {'nodes': [n.get('ref') for n in w.findall('nd')]}
            for w in root.findall('way') if w.get('id') in WAY_IDS]
    assert {w['id'] for w in ways} == set(WAY_IDS)
    temporal = []
    for wid, version in [('86162950', '10'), ('916903750', '5')]:
        old = ET.parse(Path(directory) / f'way-{wid}-v{version}.osm').getroot().find('way')
        current = next(w for w in ways if w['id'] == wid)
        assert int(current['version']) == int(version) + 1
        assert current['timestamp'] == '2026-09-07T09:43:26Z'
        assert old.get('id') == wid and old.get('version') == version
        assert old.get('timestamp') < '2026-09-04T00:00:00Z'
        historical = record(old) | {'nodes': [n.get('ref') for n in old.findall('nd')]}
        temporal.append({'type': 'way', 'id': wid, 'current': current, 'selected': historical,
                         'supersededAt': current['timestamp']})
        ways[ways.index(current)] = historical
    selected = {n for w in ways for n in w['nodes']} | set(EVIDENCE_NODES)
    nodes = [record(n) | {'coordinate': [float(n.get('lon')), float(n.get('lat'))]}
             for n in root.findall('node') if n.get('id') in selected]
    for nid in ['3978156585', '279600247', '2952325480', '14049536298']:
        history = ET.parse(Path(directory) / f'node-{nid}-history.osm').getroot().findall('node')
        assert all(n.get('id') == nid for n in history)
        before = [n for n in history if n.get('timestamp') < '2026-09-04T00:00:00Z']
        old = max(before, key=lambda n: int(n.get('version')))
        later = sorted([n for n in history if int(n.get('version')) > int(old.get('version'))], key=lambda n: int(n.get('version')))
        assert int(later[0].get('version')) == int(old.get('version')) + 1
        assert old.get('visible') == 'true' and later[0].get('timestamp') == '2026-09-07T09:43:26Z'
        historical = record(old) | {'coordinate': [float(old.get('lon')), float(old.get('lat'))]}
        current = next((n for n in nodes if n['id'] == nid), None)
        nodes = [n for n in nodes if n['id'] != nid] + [historical]
        temporal.append({'type': 'node', 'id': nid, 'current': current, 'selected': historical,
                         'supersededAt': later[0].get('timestamp')})
    assert {n['id'] for n in nodes} == selected
    assert all(e['timestamp'] < '2026-09-04T00:00:00Z' for e in ways + nodes)
    restrictions = [record(r) | {'members': [m.attrib for m in r.findall('member')]}
                    for r in root.findall('relation')
                    if any(t.get('k') == 'type' and t.get('v') == 'restriction' for t in r.findall('tag'))]
    return {'temporalRestoration': temporal, 'ways': ways, 'nodes': nodes, 'restrictions': restrictions, 'xmlBounds': root.find('bounds').attrib,
            'scope': 'Complete selected road ways and original nodes, five stop-identity evidence nodes, and every restriction relation returned by the bbox API. No current OSM bus-121 relation was returned. Project documents establish the western diversion corridor; road and platform attachments remain inference.'}


if __name__ == '__main__':
    with gzip.open(sys.argv[1], 'rb') as source:
        print(json.dumps(decode(source.read(), Path(sys.argv[1]).parent), ensure_ascii=False))
