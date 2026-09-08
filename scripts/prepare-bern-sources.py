"""Decode pinned OEVTP and swissBOUNDARIES3D bytes, using only Python stdlib.

No geometric simplification, coordinate swapping, polygon flattening or inferred
connections. Keep the original OEVTP ZIP and a lossless boundary-row snapshot.
"""
import argparse
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import struct
import tempfile
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def decode(blob):
    assert blob[:2] == b'GP', 'Not a GeoPackage geometry'
    flag = blob[3]
    assert not flag & 0x30, 'Empty or extended geometry'
    assert struct.unpack_from('<i' if flag & 1 else '>i', blob, 4)[0] == 2056
    offset = 8 + [0, 32, 48, 48, 64][(flag >> 1) & 7]

    def geometry():
        nonlocal offset
        endian = '<' if blob[offset] == 1 else '>'
        assert blob[offset] in (0, 1)
        offset += 1

        def number(fmt):
            nonlocal offset
            value = struct.unpack_from(endian + fmt, blob, offset)[0]
            offset += struct.calcsize(fmt)
            return value

        kind = number('I')
        dimensions = 2 + (kind // 1000 in (1, 2)) + 2 * (kind // 1000 == 3)
        kind %= 1000

        def point():
            values = [number('d') for _ in range(dimensions)]
            assert all(math.isfinite(v) for v in values)
            assert 2400000 < values[0] < 2900000 and 1000000 < values[1] < 1400000
            return values[:2]

        if kind == 1:
            return {'type': 'Point', 'coordinates': point()}
        if kind == 2:
            return {'type': 'LineString', 'coordinates': [point() for _ in range(number('I'))]}
        if kind == 3:
            return {'type': 'Polygon', 'coordinates': [[point() for _ in range(number('I'))] for _ in range(number('I'))]}
        assert kind in (4, 5, 6), f'Unsupported WKB type {kind}'
        children = [geometry() for _ in range(number('I'))]
        child_type, name = {4: ('Point', 'MultiPoint'), 5: ('LineString', 'MultiLineString'), 6: ('Polygon', 'MultiPolygon')}[kind]
        assert all(g['type'] == child_type for g in children)
        return {'type': name, 'coordinates': [g['coordinates'] for g in children]}

    result = geometry()
    assert offset == len(blob), 'Trailing geometry bytes'
    return result


def rows(connection, table, where='1=1'):
    connection.row_factory = sqlite3.Row
    return [dict(row) for row in connection.execute(f'SELECT * FROM "{table}" WHERE {where}')]


def features(records, column):
    return [{'type': 'Feature', 'properties': {k: v for k, v in row.items() if k != column},
             'geometry': decode(row[column])} for row in records]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', default='data/bern-sources/oevtp.gpkg.zip')
    parser.add_argument('--boundary', help='Original swissBOUNDARIES3D 2026-01 GeoPackage; only needed to create boundary snapshot')
    parser.add_argument('--output', default='data/bern-sources')
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    archive = Path(args.archive).read_bytes()
    assert sha(archive) == '4e2a4fcca08cc219c871d42c957753c09318ace2172fb3614c4fe71b20a4fe19', 'Unreviewed Bern source release'
    with zipfile.ZipFile(args.archive) as z, tempfile.TemporaryDirectory() as temp:
        db = z.read('OEVTP.gpkg')
        path = Path(temp) / 'source.gpkg'
        path.write_bytes(db)
        with sqlite3.connect(path) as c:
            lines = features(rows(c, 'geodb.oevtp_linie_vw'), 'geometry')
            stops = features(rows(c, 'geodb.oevtp_halt_vw'), 'geometry')
        assert len(lines) == 518 and len(stops) == 5321
        for name in ['metadata_oevtp_linie_de.pdf', 'metadata_oevtp_halt_de.pdf', 'terms_of_use_de.pdf', 'terms_of_use_fr.pdf']:
            (output / name).write_bytes(z.read(name))
    boundary_path = output / 'boundary-rows.json.gz'
    if args.boundary:
        with sqlite3.connect(args.boundary) as c:
            areas = rows(c, 'tlm_kantonsgebiet', 'kantonsnummer=2')
            districts = rows(c, 'tlm_bezirksgebiet', 'kantonsnummer=2')
        assert len(areas) == 1 and len(districts) == 10
        pack = lambda records: [{**r, 'geom': base64.b64encode(r['geom']).decode()} for r in records]
        boundary = {'sourceSha256': sha(Path(args.boundary).read_bytes()), 'edition': '2026-01', 'canton': pack(areas), 'districts': pack(districts)}
        boundary_path.write_bytes(gzip.compress(json.dumps(boundary).encode(), mtime=0))
    boundary = json.loads(gzip.decompress(boundary_path.read_bytes()))
    unpack = lambda records: [{**r, 'geom': base64.b64decode(r['geom'])} for r in records]
    metadata = {
        'schemaVersion': 1, 'sourceCrs': 'EPSG:2056', 'coordinateModel': 'original LV95 XY, no simplification; Z/M discarded only in derived geometry',
        'sourceUrl': 'https://geofiles.be.ch/geoportal/pub/download/OEVTP/oevtp.gpkg.zip',
        'metadataUrl': 'https://www.agi.dij.be.ch/de/start/geoportal/geodaten/detail.html?code=OEVTP&type=geoproduct',
        'attribution': 'Öffentlicher Verkehr © Amt für öffentlichen Verkehr und Verkehrskoordination des Kantons Bern',
        'license': 'Bern cantonal geodata terms 2026-01-20 (free use with attribution; no Creative Commons licence assigned)',
        'termsFiles': ['terms_of_use_de.pdf', 'terms_of_use_fr.pdf'],
        'dataUpdated': '2026-01-01', 'packagePublished': '2026-07-09', 'acquiredAt': '2026-09-08T17:02:41.454390+00:00',
        'archiveSha256': sha(archive), 'geopackageSha256': sha(db),
        'boundary': {'edition': boundary['edition'], 'sourceSha256': boundary['sourceSha256'], 'snapshotSha256': sha(boundary_path.read_bytes()),
                     'attribution': '© swisstopo', 'sourceUrl': 'https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip',
                     'termsUrl': 'https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices'},
    }
    result = {'metadata': metadata, 'lines': lines, 'stops': stops,
              'canton': features(unpack(boundary['canton']), 'geom'), 'districts': features(unpack(boundary['districts']), 'geom')}
    (output / 'decoded.json.gz').write_bytes(gzip.compress(json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    (output / 'sources.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(f'Decoded {len(lines)} lines, {len(stops)} stops and all 10 Bern districts')


if __name__ == '__main__':
    main()
