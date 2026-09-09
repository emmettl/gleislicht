"""Archive MeteoSwiss hourly CFC for Swiss study days. Requires numpy, netCDF4.
Run: python scripts/ingest-orbital-clouds.py [--download]
Daily preliminary sources expire after 60 days; cached originals are retained.
"""
import gzip
import hashlib
import json
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
from netCDF4 import Dataset, num2date

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'data/orbital-cloud-sources'
OUT = ROOT / 'public/data/orbital-clouds'
URL = 'https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-satellite-derived-grid'
DATES = ['2026-09-04', '2026-09-06', '2026-09-08']


def main():
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    if '--download' in sys.argv:
        items = []
        for date in sorted({(datetime.fromisoformat(d) + timedelta(days=n)).strftime('%Y%m%d') for d in DATES for n in [-1, 0]}):
            with urllib.request.urlopen(f'{URL}/items/{date}-ch') as response:
                item = json.load(response)
            items.append(item)
            for name, asset in item['assets'].items():
                if '.cfc.h_' in name:
                    with urllib.request.urlopen(asset['href']) as response:
                        (CACHE / (name + '.gz')).write_bytes(gzip.compress(response.read(), mtime=0))
        (CACHE / 'catalogue.json').write_text(json.dumps(items, indent=2) + '\n')
    items = json.loads((CACHE / 'catalogue.json').read_text())
    frames, sources, coordinates = {}, [], None
    for item in items:
        for name, asset in item['assets'].items():
            if '.cfc.h_' not in name:
                continue
            path = CACHE / (name + '.gz')
            raw = gzip.decompress(path.read_bytes())
            with Dataset(name, memory=raw) as ds:
                lon, lat = np.array(ds['lon'][:]), np.array(ds['lat'][:])
                if coordinates is None:
                    coordinates = (lon, lat)
                else:
                    assert np.array_equal(lon, coordinates[0]) and np.array_equal(lat, coordinates[1])
                assert ds['CFC'].dimensions == ('time', 'lat', 'lon') and ds['CFC'].units == '%'
                times = num2date(ds['time'][:], ds['time'].units, ds['time'].calendar)
                for time, field in zip(times, ds['CFC'][:]):
                    valid = ~np.ma.getmaskarray(field) & np.isfinite(field.data)
                    assert np.all((field.data[valid] >= 0) & (field.data[valid] <= 100))
                    # Row zero is south, matching WebGL texture coordinates. 255 is missing, never clear sky.
                    packed = np.where(valid, np.rint(field.data), 255).astype('uint8')
                    frames[time.strftime('%Y-%m-%dT%H:%M:%SZ')] = packed
            sources.append({'file': name, 'url': asset['href'], 'sha256': hashlib.sha256(raw).hexdigest(), 'cachedFile': name + '.gz'})
    lon, lat = coordinates
    manifest = {'version': 1, 'columns': len(lon), 'rows': len(lat),
                'bounds': dict(west=float(lon[0]), east=float(lon[-1]), south=float(lat[0]), north=float(lat[-1])),
                'timezone': 'Europe/Zurich', 'intervalSeconds': 3600, 'missingValue': 255,
                'attribution': 'Source: MeteoSwiss', 'sourceUrl': 'https://opendatadocs.meteoswiss.ch/c-climate-data/c4-satellite-based-climate-data',
                'product': 'MSG / SEVIRI Cloud Fractional Cover v4.2.0; preliminary hourly satellite-derived fields',
                'retrieved': datetime.now().astimezone().isoformat(), 'days': []}
    for date in DATES:
        midnight = datetime.fromisoformat(date).replace(tzinfo=ZoneInfo('Europe/Zurich'))
        times = [(midnight + timedelta(hours=h)).astimezone(ZoneInfo('UTC')).strftime('%Y-%m-%dT%H:%M:%SZ') for h in range(25)]
        missing = [t for t in times if t not in frames]
        if missing:
            manifest['days'].append({'date': date, 'available': False, 'reason': 'MeteoSwiss hourly files not yet published', 'missingTimes': missing})
            continue
        data = np.stack([frames[t] for t in times]).tobytes()
        compressed = gzip.compress(data, mtime=0)
        name = date + '.bin.gz'
        (OUT / name).write_bytes(compressed)
        manifest['days'].append({'date': date, 'available': True, 'file': name, 'frames': 25,
                                 'startUtc': times[0], 'endUtc': times[-1], 'bytes': len(compressed),
                                 'decodedBytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                                 'missingCells': data.count(bytes([255]))})
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (ROOT / 'data/orbital-cloud-audit.json').write_text(json.dumps({'sources': sources, 'days': manifest['days'],
        'processing': 'Native grid; percentages rounded to uint8, 255 missing; 25 UTC-indexed frames per CEST day. No wind or cloud height inferred.'}, indent=2) + '\n')
    print(json.dumps(manifest['days'], indent=2))


if __name__ == '__main__':
    main()
