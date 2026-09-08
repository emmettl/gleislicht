"""Publish pinned annual summaries and a reviewed typical weekday profile."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/regional-road-expansion-sources/2026-09-08'


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def body(name, manifest):
    entry = next(item for item in manifest['sources'] if item['path'] == name)
    raw = (SOURCES / entry['storedPath']).read_bytes()
    if entry['encoding'] == 'gzip':
        raw = gzip.decompress(raw)
    if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
        raise ValueError(f'Source integrity failure: {name}')
    return raw


def number(value):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0:
        raise ValueError(f'Invalid statistic: {value}')
    return value


def geneva_record(feature):
    row = feature['attributes']
    if not row['NO_POINT_MESURE']:
        raise ValueError('Missing measurement-point identity')
    def daily(value, year):
        reference = int(row[year]) if row[year] is not None else None
        if reference is not None and not 1900 <= reference <= 2026:
            raise ValueError('Invalid reference year')
        return {'value': number(row[value]), 'referenceYear': reference}
    return {
        'id': row['NO_POINT_MESURE'], 'name': row['NOM_POINT_DE_MESURE'] or row['NOM_VOIE'] or row['NO_POINT_MESURE'],
        'road': row['NOM_VOIE'], 'direction': row['DIRECTION'], 'siredo': row['NO_SIREDO'],
        'dailyMean': daily('TJM', 'TJM_ANNEE'), 'workingDayMean': daily('TJOM', 'TJOM_ANNEE'),
        'morningPeak': number(row['HPM']), 'eveningPeak': number(row['HPS']), 'peakReferencePeriod': None,
        'availability': row['DISPONIBILITE'], 'detectorType': row['CAPTEUR'],
    }


def build(output, audit_output):
    manifest = json.loads((SOURCES / 'manifest.json').read_text())
    points = json.loads(body('geneva-points.json', manifest))
    count = json.loads(body('geneva-count.json', manifest))['count']
    if points.get('exceededTransferLimit') or len(points['features']) != count:
        raise ValueError('Incomplete Geneva inventory')
    records = sorted([geneva_record(feature) for feature in points['features']], key=lambda row: row['id'])
    if len({row['id'] for row in records}) != len(records):
        raise ValueError('Duplicate Geneva measurement-point identity')
    geneva = {'schemaVersion': 1, 'source': 'geneva', 'basis': 'annual-summary', 'playbackEligible': False,
              'acquiredDate': manifest['checkedDate'], 'attribution': 'Données SITG',
              'sourceUrl': 'https://sitg.ge.ch/donnees/otc-comptage-trafic', 'records': records}
    review = json.loads((ROOT / 'data/luzern-road-profile-review.json').read_text())
    if review['profileBasis'] != 'average-weekday' or review['unit'] != 'vehicles/hour':
        raise ValueError('Unsupported profile meaning')
    if hashlib.sha256(body(review['sourceFile'], manifest)).hexdigest() != review['sourceSha256']:
        raise ValueError('Reviewed report hash mismatch')
    for key in ('QS', 'R1', 'R2'):
        if len(review['hours'][key]) != 24 or any(number(v) is None for v in review['hours'][key]):
            raise ValueError('Incomplete reviewed profile')
    catalog = json.loads(body('luzern-miv-points.json', manifest))['features']
    matched = [feature['attributes'] for feature in catalog if str(feature['attributes']['NUMMER_VERKZAEHLER']) == review['stationId'] and feature['attributes']['ZUSTAENDIGKET'] == 'Kanton Luzern']
    if len(matched) != 1 or review['sourceUrl'] not in matched[0].values():
        raise ValueError('Reviewed report is not uniquely linked by the source catalogue')
    differences = [hour for hour in range(24) if review['hours']['QS'][hour] != review['hours']['R1'][hour] + review['hours']['R2'][hour]]
    if any(abs(review['hours']['QS'][h] - review['hours']['R1'][h] - review['hours']['R2'][h]) > 1 for h in differences):
        raise ValueError('Direction totals require review beyond separate rounding')
    luzern = {'schemaVersion': 1, 'source': 'luzern', 'basis': 'average-weekday', 'playbackEligible': False,
              'acquiredDate': manifest['checkedDate'], 'attribution': 'Kanton Luzern, Verkehr und Infrastruktur (vif)',
              'sourceUrl': review['sourceUrl'], 'profile': {key: review[key] for key in ('stationId', 'name', 'period', 'dailyMean', 'hours')},
              'catalogueDailyMean': number(matched[0]['DTV']), 'catalogueReferenceYear': None,
              'catalogueDiscrepancy': matched[0]['DTV'] != review['dailyMean'], 'reviewedProfiles': 1}
    output.mkdir(parents=True, exist_ok=True)
    files = {}
    for source, data in [('geneva', geneva), ('luzern', luzern)]:
        raw = encoded(data); (output / f'{source}.json').write_bytes(raw)
        files[source] = {'path': f'{source}.json', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    index = {'schemaVersion': 1, 'files': files}
    (output / 'index.json').write_bytes(encoded(index))
    audit = {'sourceManifest': str(SOURCES.relative_to(ROOT) / 'manifest.json'), 'acquiredDate': manifest['checkedDate'],
             'playbackEligible': False, 'genevaPoints': len(records),
             'genevaDistinctSiredo': len({row['siredo'] for row in records}),
             'genevaMissingDailyMeans': sum(row['dailyMean']['value'] is None for row in records),
             'genevaAvailability': dict(sorted(Counter(row['availability'] for row in records).items())),
             'luzernReviewedProfiles': 1, 'luzernCatalogueDiscrepancy': luzern['catalogueDiscrepancy'],
             'luzernSeparatelyRoundedHours': differences, 'files': files}
    audit_output.parent.mkdir(parents=True, exist_ok=True)
    audit_output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    return audit


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/geneva-luzern-statistics')
    parser.add_argument('--audit', type=Path, default=ROOT / 'data/geneva-luzern-statistics-audit.json')
    args = parser.parse_args()
    print(json.dumps(build(args.output, args.audit)))
