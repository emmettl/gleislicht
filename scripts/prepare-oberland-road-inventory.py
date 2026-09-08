"""Inventory every Pfäffikon, Wetzikon and Gossau settlement in SwissNames 2026."""
import argparse
import csv
import hashlib
import io
import json
import pathlib
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--archive', required=True)
args = parser.parse_args()
body = pathlib.Path(args.archive).read_bytes()
archive = zipfile.ZipFile(io.BytesIO(body))
names = ['Pfäffikon', 'Wetzikon', 'Gossau']
rows, members = [], []
for member in ['swissNAMES3D_LIN.csv', 'swissNAMES3D_PKT.csv', 'swissNAMES3D_PLY.csv']:
    raw = archive.read(member)
    records = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig')), delimiter=';'))
    selected = [r for r in records if r['OBJEKTKLASSE_TLM'] == 'TLM_SIEDLUNGSNAME'
                and any(r['NAME'] == n or r['NAME'].startswith(n + ' ') for n in names)]
    rows.extend(selected)
    members.append(dict(member=member, sha256=hashlib.sha256(raw).hexdigest(),
                        totalRows=len(records), selectedRows=len(selected)))
report = dict(schemaVersion=1,
              sourceUrl='https://data.geo.admin.ch/ch.swisstopo.swissnames3d/swissnames3d_2026/swissnames3d_2026_2056.csv.zip',
              archiveSha256=hashlib.sha256(body).hexdigest(), members=members,
              predicate='Every TLM_SIEDLUNGSNAME row named Pfäffikon, Wetzikon or Gossau, including names followed by a space and qualifier, across all three CSV members.',
              rows=sorted(rows, key=lambda r: r['UUID']))
pathlib.Path('data/oberland-road-settlement-inventory.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n')
