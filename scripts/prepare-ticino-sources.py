#!/usr/bin/env python3
"""Extract the complete TI canton and district polygons from the pinned national boundary."""
import argparse
import importlib.util
import json
from pathlib import Path
import sqlite3

spec = importlib.util.spec_from_file_location('boundary', Path(__file__).with_name('prepare-aargau-sources.py'))
boundary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundary)

def prepare(gpkg, output):
    out = Path(output); out.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect('file:'+str(Path(gpkg).resolve())+'?mode=ro', uri=True) as db:
        rows = db.execute('SELECT geom,uuid,datum_aenderung,name FROM tlm_kantonsgebiet WHERE kantonsnummer=21').fetchall()
        assert len(rows) == 1 and rows[0][3] == 'Ticino'
        row = rows[0]
        districts = db.execute('SELECT geom,name,bezirksnummer FROM tlm_bezirksgebiet WHERE kantonsnummer=21').fetchall()
    (out/'canton.gpkggeom').write_bytes(row[0])
    (out/'boundary.json').write_text(json.dumps(boundary.decode_boundary(row[0]), separators=(',', ':'))+'\n')
    (out/'districts.json').write_text(json.dumps([dict(name=r[1], number=r[2], geometry=boundary.decode_boundary(r[0])) for r in districts], separators=(',', ':'))+'\n')
    assert len(districts) == 8
    metadata = dict(schemaVersion=1, boundary=dict(source='swissBOUNDARIES3D', edition='2026-01',
        url='https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip',
        sourceGpkgSha256=boundary.sha(gpkg), recordUuid=row[1], recordModified=row[2], cantonNumber=21,
        attribution='© swisstopo', termsUrl='https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices'),
        transformation='Unsimplified multipart polygons and holes; approximate swisstopo LV95 to WGS84 polynomial, seven decimals, metre-level accuracy.',
        files={name: dict(sha256=boundary.sha(out/name), bytes=(out/name).stat().st_size) for name in ['canton.gpkggeom','boundary.json','districts.json']})
    (out/'sources.json').write_text(json.dumps(metadata, indent=2)+'\n')
    print(dict(districts=len(districts), boundary=metadata['boundary']))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boundary-gpkg', required=True)
    parser.add_argument('--output', default='data/ticino-sources')
    args=parser.parse_args(); prepare(args.boundary_gpkg, args.output)
