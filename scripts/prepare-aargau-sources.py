#!/usr/bin/env python3
"""Decode pinned AGIS PolyLine/DBF and a swissBOUNDARIES3D canton, stdlib only.

prepare-aargau-sources.py --lines ZIP --boundary-gpkg GPKG --output DIR
The output retains raw ZIP, canton GeoPackage geometry, terms, metadata, hashes.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import shutil
import sqlite3
import struct
import zipfile


def sha(path):
    with open(path, 'rb') as f:
        h = hashlib.sha256()
        for block in iter(lambda: f.read(1024*1024), b''): h.update(block)
        return h.hexdigest()


def lv95_to_wgs84(p):
    # swisstopo approximate transformation, metre-level accuracy. No geometry
    # simplification. Identical transformation for line and canton coordinates.
    y, x = (p[0]-2600000)/1000000, (p[1]-1200000)/1000000
    lon = 2.6779094+4.728982*y+0.791484*y*x+0.1306*y*x*x-0.0436*y*y*y
    lat = 16.9023892+3.238272*x-0.270978*y*y-0.002528*x*x-0.0447*y*y*x-0.014*x*x*x
    return [round(lon*100/36, 7), round(lat*100/36, 7)]


def decode_lines(path):
    with zipfile.ZipFile(path) as z:
        def member(suffix):
            names = [n for n in z.namelist() if n.endswith(suffix)]
            assert len(names) == 1, (suffix, names)
            return z.read(names[0])
        assert b'CH1903+_LV95' in member('.prj')
        encoding = member('.cpg').decode().strip()
        dbf = member('.dbf')
        count, header, width = struct.unpack_from('<IHH', dbf, 4)
        fields = []
        for i in range(32, header-1, 32):
            field = dbf[i:i+32]
            fields.append((field[:11].split(b'\0')[0].decode(), chr(field[11]), field[16]))
        records = []
        for i in range(count):
            pos = header+i*width
            assert dbf[pos:pos+1] == b' ', 'Deleted DBF record requires explicit handling'
            pos += 1
            record = {}
            for name, kind, length in fields:
                value = dbf[pos:pos+length].decode(encoding).strip()
                record[name] = float(value) if kind == 'F' and value else value
                pos += length
            records.append(record)
        shp = member('.shp')
        assert struct.unpack_from('>I', shp)[0] == 9994
        assert struct.unpack_from('>I', shp, 24)[0]*2 == len(shp)
        assert struct.unpack_from('<II', shp, 28) == (1000, 3), 'Expected 2D PolyLine'
        offset, features = 100, []
        while offset < len(shp):
            record_id, words = struct.unpack_from('>II', shp, offset)
            body = shp[offset+8:offset+8+words*2]
            assert len(body) == words*2 and struct.unpack_from('<I', body)[0] == 3
            parts, points = struct.unpack_from('<II', body, 36)
            starts = list(struct.unpack_from('<'+'I'*parts, body, 44))+[points]
            assert starts[0] == 0 and all(b > a for a, b in zip(starts, starts[1:]))
            coords = [struct.unpack_from('<dd', body, 44+4*parts+16*i) for i in range(points)]
            assert all(2500000 < x < 2800000 and 1100000 < y < 1350000 and math.isfinite(x+y) for x, y in coords)
            lines = [[lv95_to_wgs84(p) for p in coords[a:b]] for a, b in zip(starts, starts[1:])]
            assert all(len(line) >= 2 for line in lines)
            features.append({'type': 'Feature', 'id': record_id, 'properties': records[len(features)], 'geometry': {'type': 'MultiLineString', 'coordinates': lines}})
            offset += 8+words*2
        assert len(features) == count
        return {'type': 'FeatureCollection', 'features': features}


def decode_boundary(blob):
    assert blob[:2] == b'GP'
    envelope = (blob[3] >> 1) & 7
    pos = 8+[0, 32, 48, 48, 64][envelope]
    def geometry():
        nonlocal pos
        endian = '<' if blob[pos] == 1 else '>'
        pos += 1
        def unpack(fmt):
            nonlocal pos
            v = struct.unpack_from(endian+fmt, blob, pos)
            pos += struct.calcsize(endian+fmt)
            return v
        typ, = unpack('I')
        dims, kind = 2+(typ//1000 in (1, 2))+2*(typ//1000 == 3), typ % 1000
        count, = unpack('I')
        if kind == 6:
            return [geometry() for _ in range(count)]
        assert kind == 3
        rings = []
        for _ in range(count):
            n, = unpack('I')
            rings.append([lv95_to_wgs84(unpack('d'*dims)) for _ in range(n)])
        return rings
    polygons = geometry()
    assert pos == len(blob)
    return {'type': 'MultiPolygon', 'coordinates': polygons}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lines', required=True)
    parser.add_argument('--boundary-gpkg', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    archive = out/'agis-lines-20260423.zip'
    if Path(args.lines).resolve() != archive.resolve(): shutil.copyfile(args.lines, archive)
    collection = decode_lines(archive)
    with zipfile.ZipFile(archive) as z:
        for name, output in [('Nutzungsbedingungen.pdf', 'supplied-terms.pdf'), ('AGIS.avk_oevlinien/Dokumentation/AGIS.avk_oevlinien.pdf', 'supplied-metadata.pdf')]:
            (out/output).write_bytes(z.read(name))
    (out/'lines.json.gz').write_bytes(gzip.compress(json.dumps(collection, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    with sqlite3.connect('file:'+str(Path(args.boundary_gpkg).resolve())+'?mode=ro', uri=True) as db:
        rows = db.execute("SELECT geom,uuid,datum_aenderung,name,kantonsnummer FROM tlm_kantonsgebiet WHERE kantonsnummer=19").fetchall()
        assert len(rows) == 1 and rows[0][3] == 'Aargau'
        row = rows[0]
    (out/'canton.gpkggeom').write_bytes(row[0])
    (out/'boundary.json').write_text(json.dumps(decode_boundary(row[0]), separators=(',', ':'))+'\n')
    probe_file = Path('data/swiss-transit-source-probes.json')
    probes = json.loads(probe_file.read_text())['probes']
    probe = next(p for p in probes if p['id'] == 'ag-lines')
    assert probe['sha256'] == sha(archive), 'Pinned AGIS bytes differ from survey'
    metadata = {
        'schemaVersion': 1,
        'lines': {'url': probe['url'], 'retrievedAt': probe['checkedAt'], 'dataDate': '2026-04-23', 'normalTimetableOnly': True, 'features': len(collection['features']), 'attribution': 'Daten des Kantons Aargau', 'terms': 'supplied-terms.pdf', 'metadata': 'supplied-metadata.pdf'},
        'boundary': {'source': 'swissBOUNDARIES3D', 'url': 'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip', 'edition': '2026-01', 'sourceGpkgSha256': sha(args.boundary_gpkg), 'recordUuid': row[1], 'recordModified': row[2], 'cantonNumber': 19, 'attribution': '© swisstopo'},
        'transformation': {'sourceCrs': 'EPSG:2056', 'outputCrs': 'EPSG:4326', 'method': 'swisstopo approximate LV95 to WGS84 polynomial; metre-level accuracy; seven decimal places; no simplification; polygon holes and multipart boundaries retained'},
        'files': {p.name: {'sha256': sha(p), 'bytes': p.stat().st_size} for p in sorted(out.iterdir()) if p.is_file() and p.name != 'sources.json'},
    }
    (out/'sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'features': len(collection['features']), 'files': metadata['files']}, indent=2))


if __name__ == '__main__': main()
