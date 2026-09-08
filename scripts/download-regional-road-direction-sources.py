"""Pin selected official detector plans and exact swissNAMES3D settlement searches."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlencode
import zipfile

NAMES = ['Arbon', 'Roggwil', 'Kreuzlingen', 'Romanshorn', 'Schaffhausen', 'Frauenfeld',
         'Weinfelden', 'Matzingen', 'Bischofszell', 'Sulgen', 'Amriswil', 'Eschlikon',
         'Basadingen', 'Diessenhofen', 'Märstetten', 'Bottighofen']
PLANS = ['ZS001-K789-Detektorplan.pdf', 'ZS040-K003-Detektorplan.pdf', 'ZS069-K035-Detektorplan.pdf']
ARCHIVE_URL = 'https://data.stadt-zuerich.ch/dataset/sid_dav_verkehrszaehlung_miv_od2031/download/Zaehlstellen_Detail.zip'


def acquire(directory, archive):
    directory.mkdir(parents=True, exist_ok=False)
    manifest = {'schemaVersion': 1, 'purpose': 'regional-road-direction-evidence', 'complete': False,
                'files': [], 'archive': {'url': ARCHIVE_URL,
                    'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size}}
    with zipfile.ZipFile(archive) as z:
        for name in PLANS:
            body = z.read(name)
            if not body.startswith(b'%PDF-'):
                raise ValueError('Invalid plan PDF')
            (directory/name).write_bytes(body)
            manifest['files'].append({'id': name, 'path': name, 'kind': 'detector-plan',
                'sourceMember': name, 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
                'acquiredAt': datetime.now(timezone.utc).isoformat(), 'license': 'CC0 (parent municipal count catalogue)'})

    def get(pair):
        i, name = pair
        url = 'https://api3.geo.admin.ch/rest/services/ech/MapServer/find?'+urlencode({
            'layer': 'ch.swisstopo.swissnames3d', 'searchText': name, 'searchField': 'name',
            'contains': 'false', 'sr': '2056', 'geometryFormat': 'geojson'})
        body = subprocess.check_output(['curl', '--fail', '--silent', '--show-error', '--max-time', '60', '--retry', '2', url])
        if not isinstance(json.loads(body).get('results'), list):
            raise ValueError('Invalid settlement search response')
        path = f'settlement-{i:02d}.json.gz'
        (directory/path).write_bytes(gzip.compress(body, mtime=0))
        return {'id': name, 'path': path, 'kind': 'settlement', 'url': url,
            'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
            'acquiredAt': datetime.now(timezone.utc).isoformat(), 'publisher': 'swisstopo / swissNAMES3D'}

    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(get, enumerate(NAMES)):
            manifest['files'].append(result)
            (directory/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
            print(result['id'], flush=True)
    manifest['complete'] = True
    (directory/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--plans-archive', type=Path, required=True)
    args = parser.parse_args()
    acquire(args.output, args.plans_archive)
