"""Extract every Wald settlement from the complete official 2026 CSV archive."""
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
members = ['swissNAMES3D_LIN.csv', 'swissNAMES3D_PKT.csv', 'swissNAMES3D_PLY.csv']
rows, audits = [], []
for member in members:
    raw = archive.read(member)
    records = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig')), delimiter=';'))
    selected = [r for r in records if r['OBJEKTKLASSE_TLM'] == 'TLM_SIEDLUNGSNAME'
                and (r['NAME'] == 'Wald' or r['NAME'].startswith('Wald '))]
    rows.extend(selected)
    audits.append(dict(member=member, sha256=hashlib.sha256(raw).hexdigest(),
                       totalRows=len(records), selectedRows=len(selected)))
report = dict(schemaVersion=1,
              sourceUrl='https://data.geo.admin.ch/ch.swisstopo.swissnames3d/swissnames3d_2026/swissnames3d_2026_2056.csv.zip',
              archiveSha256=hashlib.sha256(body).hexdigest(), members=audits,
              predicate='All TLM_SIEDLUNGSNAME rows named Wald or starting with Wald and a space, across all three CSV members.',
              rows=sorted(rows, key=lambda r: r['UUID']))
pathlib.Path('data/bauma-wald-settlement-inventory.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n')
