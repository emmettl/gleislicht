"""Decode the complete retained FOT cableway XML; retain original LV95 geometry."""
import json, sys, zipfile, xml.etree.ElementTree as ET

def decode(path):
    with zipfile.ZipFile(path) as archive:
        members = [n for n in archive.namelist() if n.endswith('.xtf')]
        assert len(members) == 1
        root = ET.fromstring(archive.read(members[0]))
    def tag(node): return node.tag.rsplit('}', 1)[-1]
    def child(node, name): return next((n for n in node if tag(n) == name), None)
    def value(node, name):
        nodes = [n for n in node.iter() if tag(n) == name]
        assert len(nodes) <= 1
        return nodes[0].text if nodes else None
    def ref(node): return child(node, 'rAnlage').attrib['REF']
    def points(node):
        result = []
        for c in node.iter():
            if tag(c) != 'COORD': continue
            p = [float(value(c, a)) for a in ['C1', 'C2']]
            assert 2400000 < p[0] < 2900000 and 1000000 < p[1] < 1400000
            result.append(p)
        return result
    result = dict(installations=[], stations=[], segments=[])
    for node in root.iter():
        kind = tag(node)
        if kind == 'Seilbahnen_V2_0.Seilbahnen.Anlage':
            row = {'id': node.attrib['TID']}
            for out, key in [('number','AnlageNr'), ('name','AnlageName'), ('type','Bahntyp'), ('vehicle','Fahrzeugtyp'), ('operator','TUNummer'), ('operatorAbbreviation','TUAbkuerzung'), ('sourceDate','Stand'), ('validFrom','BeginnGueltigkeit'), ('validUntil','EndeGueltigkeit')]: row[out] = value(node, key)
            result['installations'].append(row)
        elif kind == 'Seilbahnen_V2_0.Seilbahnen.Station':
            p = points(node); assert len(p) == 1
            result['stations'].append(dict(id=node.attrib['TID'], installation=ref(node), number=value(node,'Nummer'), name=value(node,'Name'), coordinate=p[0]))
        elif kind == 'Seilbahnen_V2_0.Seilbahnen.Seilbahnstrecke':
            lines = [points(n) for n in node.iter() if tag(n) == 'POLYLINE']
            assert lines and all(len(line) >= 2 for line in lines)
            result['segments'].append(dict(id=node.attrib['TID'], installation=ref(node), lines=lines))
    ids = {i['id'] for i in result['installations']}
    for name, rows in result.items():
        assert rows and len({r['id'] for r in rows}) == len(rows)
        if name != 'installations': assert all(r['installation'] in ids for r in rows)
    return result

if __name__ == '__main__': print(json.dumps(decode(sys.argv[1]), separators=(',', ':')))
