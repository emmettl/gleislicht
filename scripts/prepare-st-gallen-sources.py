#!/usr/bin/env python3
"""Acquire and decode the public AL_OEV archive, retaining its exact bytes locally.

No new dependencies: reuse the checked PolyLine/DBF decoder, one layer at a
 time. Raw vectors stay in an ignored local directory pending redistribution
permission; hashes, schema and source identities are reviewable in the audit.
"""
import argparse
import datetime
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('ag_decoder', ROOT/'scripts/prepare-aargau-sources.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
LAYERS = {'rail': 'BAHNLINIEN', 'bus': 'BUSLINIEN', 'city': 'GESAMTSYSTEME_STADT_ORTSBUS', 'mountain': 'LUFTSEILBAHNEN', 'boat': 'SCHIFFSVERKEHR'}
ARCHIVE_URL = 'https://data.geo.sg.ch/public.php/dav/files/RMgBWPofwkaCawf/Geodaten/3%20-%20Bev%C3%B6lkerung%20und%20Wirtschaft/P%20-%20Verkehr/AbgeltungsberechtigteLinien/AbgeltungsberechtigteLinien_AL_OEV_shp.zip'
BOUNDARY_URL = 'https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-kanton-flaeche.fill/17?sr=4326&geometryFormat=geojson'
METADATA_URL = 'https://www.sg.ch/bauen/geoinformation/gi/geodaten/al.html'
TERMS_URL = 'https://www.sg.ch/bauen/geoinformation/datenbezug/agb.html'
sha = lambda b: hashlib.sha256(b).hexdigest()


def prepare_shared_evidence(directory, inspect_cache=False):
    """Acquire pinned corridor/anchor evidence without changing the AL_OEV catalogue."""
    out = Path(directory); out.mkdir(parents=True, exist_ok=True)
    policy = json.loads((ROOT/'data/st-gallen-policy.json').read_text())
    records = []
    for corridor in policy.get('sharedCorridors', []) + policy.get('stopAnchors', []):
        for evidence in corridor['evidence']:
            target = out/evidence['file']
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                assert not inspect_cache, 'Missing cached corridor evidence: '+evidence['file']
                with tempfile.TemporaryDirectory() as tmp:
                    downloaded = Path(tmp)/'evidence.pdf'
                    subprocess.run(['curl', '-fLsS', '--max-time', '60', evidence['url'], '-o', str(downloaded)], check=True)
                    assert sha(downloaded.read_bytes()) == evidence['sha256'], 'Publisher map changed; explicit review required'
                    shutil.copyfile(downloaded, target)
            assert sha(target.read_bytes()) == evidence['sha256'], 'Changed cached corridor evidence: '+evidence['file']
            records.append(dict(file=evidence['file'], sha256=evidence['sha256'], verified=True))
    return records


def prepare(directory, archive=None, inspect_cache=False):
    out = Path(directory); out.mkdir(parents=True, exist_ok=True)
    sources = []
    previous = json.loads((out/'sources.json').read_text()) if inspect_cache else None
    def save(name, url, supplied=None, **extra):
        target = out/name
        if inspect_cache:
            record = next(s for s in previous['sources'] if s['file'] == name)
            assert sha(target.read_bytes()) == record['sha256'], 'Changed cached source: '+name
            sources.append(record)
            return target.read_bytes()
        if supplied:
            if Path(supplied).resolve() != target.resolve(): shutil.copyfile(supplied, target)
        else:
            subprocess.run(['curl', '-fLsS', '--max-time', '60', url, '-o', str(target)], check=True)
        b = target.read_bytes()
        sources.append(dict(file=name, url=url, retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), sha256=sha(b), bytes=len(b), **extra))
        return b
    raw = save('al-oev-20260324.zip', ARCHIVE_URL, archive, archiveDate='2026-03-24', geometryVintage='2026 timetable; export 2026-03-24; no per-feature survey timestamp')
    save('boundary.json', BOUNDARY_URL, attribution='© swisstopo', vintage=None)
    assert json.loads((out/'boundary.json').read_text())['feature']['properties']['ak'] == 'SG'
    save('metadata.html', METADATA_URL)
    save('terms.html', TERMS_URL, websiteModified='2022-01-12')
    with zipfile.ZipFile(out/'al-oev-20260324.zip') as z:
        assert all(n.startswith('2026-03-24/') or n.endswith('.pdf') for n in z.namelist()), 'Unreviewed export date'
        for name in ['Datennutzungsbestimmungen.pdf', 'AOEV_AL_OEV_Datenbeschreibung.pdf']:
            b = z.read(name); (out/name).write_bytes(b)
            sources.append(dict(file=name, derivedFrom=['al-oev-20260324.zip'], sha256=sha(b), bytes=len(b)))
        for layer, stem in LAYERS.items():
            names = [n for n in z.namelist() if n.split('/')[-1].startswith('AL_OEV_'+stem+'_L.')]
            assert len(names) == 5
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp)/'layer.zip'
                with zipfile.ZipFile(path, 'w') as single:
                    for n in names: single.writestr(n, z.read(n))
                collection = module.decode_lines(path)
            expected = {'rail':45,'bus':145,'city':34,'mountain':1,'boat':1}[layer]
            assert len(collection['features']) == expected, 'Unreviewed feature census'
            b = gzip.compress(json.dumps(collection, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0)
            name = layer+'.geojson.gz'; (out/name).write_bytes(b)
            sources.append(dict(file=name, derivedFrom=['al-oev-20260324.zip'], archiveMembers=names, features=expected, sha256=sha(b), bytes=len(b)))
    catalogue = dict(schemaVersion=1, sources=sources, transformation=dict(sourceCrs='EPSG:2056', outputCrs='EPSG:4326', method='swisstopo approximate polynomial, metre-level accuracy, seven decimal places, no simplification; exact shared vertices only'),
        attribution=['© Kanton St.Gallen, Amt für öffentlichen Verkehr / AREG', 'Underlying alignment: swissTNE Base, © swisstopo'],
        reuse=dict(license='publisher-specific restricted terms; not an open-data licence', termsUrl=TERMS_URL, suppliedTermsVersion='2019-06-01', currentWebsiteModified='2022-01-12', redistributionApproved=False, decision='Local source-adapter evaluation and regional feed. Do not publish raw or derived vectors without resolving the publisher permission requirement (current clause 18; supplied clause 20). Attribution, vintage, no legal effect and disclaimer must accompany permitted application display.'))
    if inspect_cache:
        assert catalogue == previous, 'Decoder or source metadata changed; review before replacing snapshot'
    (out/'sources.json').write_text(json.dumps(catalogue,ensure_ascii=False,indent=2)+'\n')
    prepare_shared_evidence(out, inspect_cache)
    return catalogue

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default='data/st-gallen-sources/local')
    parser.add_argument('--archive')
    parser.add_argument('--inspect-cache', action='store_true', help='Verify and re-decode saved bytes without network or changed retrieval timestamps')
    parser.add_argument('--shared-evidence-only', action='store_true', help='Acquire/verify the pinned supporting map without refreshing the source catalogue')
    args=parser.parse_args()
    result = prepare_shared_evidence(args.output,args.inspect_cache) if args.shared_evidence_only else prepare(args.output,args.archive,args.inspect_cache)
    print(json.dumps(result,ensure_ascii=False,indent=2))
