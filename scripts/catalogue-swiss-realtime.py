#!/usr/bin/env python3
"""Preserve the official semicolon-delimited coverage catalogue without identity guesses."""
import collections
import csv
import hashlib
import io
import json
import pathlib
import sys

source, probes_path, output = map(pathlib.Path, sys.argv[1:])
body = source.read_bytes()
probe = next(p for p in json.loads(probes_path.read_text())['probes'] if p['id'] == 'national-rt-csv')
assert hashlib.sha256(body).hexdigest() == probe['sha256']
rows = list(csv.DictReader(io.StringIO(body.decode('utf-8-sig')), delimiter=';'))
fields = ['sboid', 'descriptionEn', 'abbreviationEn', 'vdvBetreiberId', 'source',
          'siriVDV', 'etAUS', 'ptREFAUS', 'complete', 'comment']
assert rows and list(rows[0]) == fields
assert all(None not in row and all(value is not None for value in row.values()) for row in rows)
result = {
    'schemaVersion': 1, 'sourceId': probe['id'], 'sourceUrl': probe['url'],
    'checkedAt': probe['checkedAt'], 'sourceSha256': probe['sha256'],
    'limits': 'Catalogue declarations, not a live endpoint test. Multiple records per operator are preserved. '
              'Do not equate VDV IDs with GTFS agency IDs without a reviewed mapping. '
              'etAUS and completeness flags do not promise GPS positions or every line.',
    'totals': {'rows': len(rows), **{key: dict(collections.Counter(row[key] for row in rows))
                                  for key in ['etAUS', 'ptREFAUS', 'complete']}},
    'entries': rows,
}
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result['totals']))
