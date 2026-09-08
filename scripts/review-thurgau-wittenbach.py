"""Replay the four preserved matcher failures without modifying stop calls."""
import csv,gzip,json,hashlib,math
from pathlib import Path
root=Path('data/thurgau-regional-roads')
cache=json.loads(gzip.decompress((root/'cache.json.gz').read_bytes()))['caches']['801']
raw=json.loads(gzip.decompress(Path('data/thurgau-audit/timetable-cache.json.gz').read_bytes()))
issues=cache['report']['issues']; assert len(issues)==4
matched=list(csv.DictReader(gzip.open(root/'801/stop_times.txt.gz','rt')))
rows=[]
for issue in issues:
 calls=[r for r in matched if r['trip_id']==issue['pattern']][:2]
 assert [r['stop_id'] for r in calls]==[issue['fromId'],issue['toId']]
 assert [float(r['shape_dist_traveled']) for r in calls]==[0,0]
 days=[]
 for day in raw['snapshots']:
  audit=json.loads(Path(f'data/thurgau-audit/{day["metadata"]["serviceDate"]}.json').read_text())
  patterns=[p for p in audit['patterns'] if p.get('roadPatternId')==issue['pattern']]
  assert all(not p['admittedTrips'] for p in patterns)
  days.append({'date':day['metadata']['serviceDate'],'journeys':sum(p['trips'] for p in patterns),'patternIds':[p['id'] for p in patterns]})
 a,b=[next(s for s in raw['snapshots'][0]['stops'] if s[4]==id) for id in [issue['fromId'],issue['toId']]]
 distance=111320*math.hypot((a[0]-b[0])*math.cos(math.radians((a[1]+b[1])/2)),a[1]-b[1])
 rows.append({'roadPatternId':issue['pattern'],'routeId':issue['routeId'],'from':a,'to':b,'directDistanceMetres':distance,'matcherCalls':calls,'days':days,'decision':'Excluded: distinct platforms, zero source shape distance; no inferred turnaround or stop substitution.'})
assert sum(x['days'][0]['journeys'] for x in rows)==37
report={'reviewed':'2026-09-08','sourceHashes':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'cache.json.gz',root/'801/stop_times.txt.gz']},'patterns':rows,'nextEvidence':'Acquire a verified vehicle turnaround or operator-specific full-pattern geometry between Wittenbach Zentrum platforms 2 and 1. A straight connection between their coordinates is not evidence of a bus path.'}
Path('data/thurgau-audit/wittenbach-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print({'patterns':len(rows),'fridayJourneys':37,'platformDistanceMetres':rows[0]['directDistanceMetres']})
