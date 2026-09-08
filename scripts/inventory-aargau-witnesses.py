#!/usr/bin/env python3
"""Exhaustive annual calendar witnesses for routes absent from the twelve-date sample.
Uses the pinned archive and canton membership; writes an audit, never a release feed.
"""
import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
from collections import Counter, defaultdict
from pathlib import Path
import zipfile


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()


def seconds(value):
    h, m, s = map(int, value.split(':'))
    assert h >= 0 and 0 <= m < 60 and 0 <= s < 60
    return h * 3600 + m * 60 + s


def service_dates(calendar, exceptions, first, last):
    days = set()
    if calendar:
        for offset in range((last - first).days + 1):
            day = first + dt.timedelta(days=offset)
            if calendar['start_date'] <= day.strftime('%Y%m%d') <= calendar['end_date'] and calendar[day.strftime('%A').lower()] == '1': days.add(day)
    for row in exceptions:
        day = dt.datetime.strptime(row['date'], '%Y%m%d').date()
        if not first <= day <= last: continue
        assert row['exception_type'] in ('1', '2')
        if row['exception_type'] == '1': days.add(day)
        else: days.discard(day)
    return sorted(days)


def civil_dates(days, start, end, first, last):
    # Match the existing importer: selected and preceding service days, complete intersecting chains.
    result = []
    for day in days:
        for offset in (0, 1):
            civil = day + dt.timedelta(days=offset)
            if first <= civil <= last and start - offset * 86400 < 86400 and end - offset * 86400 > 0:
                result.append((civil.isoformat(), day.isoformat(), -offset * 86400))
    return result


def greedy_dates(route_days):
    remaining = {r for r, days in route_days.items() if days}
    selected = []
    while remaining:
        candidates = defaultdict(set)
        for route in remaining:
            for day in route_days[route]: candidates[day].add(route)
        day = min(candidates, key=lambda d: (-len(candidates[d]), d))
        covered = sorted(candidates[day])
        selected.append(dict(date=day, newlyWitnessedRoutes=covered))
        remaining.difference_update(covered)
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--output', default='data/aargau-witnesses')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = Path(args.output)
    summary_file = Path('data/aargau-seasonal/summary.json')
    inventory_file = Path('data/aargau-seasonal/input/inventory.json')
    summary = json.loads(summary_file.read_text())
    inventory = json.loads(inventory_file.read_text())
    assert sha(args.archive) == summary['archiveSha256'] == inventory['metadata']['archiveSha256']
    assert sha(inventory_file) == summary['inventorySha256']
    targets = set(summary['stillInactiveRoutes'])
    inside = set(inventory['cantonStopIds'])
    source_routes = {r['routeId']: r for r in inventory['routes'] if r['routeId'] in targets}
    assert len(source_routes) == len(targets) == 45
    trips, calls, calendars, exceptions = {}, defaultdict(list), {}, defaultdict(list)
    with zipfile.ZipFile(args.archive) as z:
        def rows(name): return csv.DictReader(io.TextIOWrapper(z.open(name), encoding='utf-8-sig', newline=''))
        feeds = list(rows('feed_info.txt')); assert len(feeds) == 1
        first, last = [dt.datetime.strptime(feeds[0][key], '%Y%m%d').date() for key in ('feed_start_date', 'feed_end_date')]
        routes = {r['route_id']: r for r in rows('routes.txt') if r['route_id'] in targets}
        for t in rows('trips.txt'):
            if t['route_id'] in targets: trips[t['trip_id']] = t
        services = {t['service_id'] for t in trips.values()}
        for r in rows('calendar.txt'):
            if r['service_id'] in services: calendars[r['service_id']] = r
        for r in rows('calendar_dates.txt'):
            if r['service_id'] in services: exceptions[r['service_id']].append(r)
        frequencies = [r for r in rows('frequencies.txt') if r['trip_id'] in trips]
        assert not frequencies, 'Frequency expansion needs explicit witness support'
        stops = {r['stop_id']: [float(r['stop_lon']), float(r['stop_lat']), r['stop_name'], r.get('platform_code', ''), r['stop_id']] for r in rows('stops.txt')}
        count = 0
        for r in rows('stop_times.txt'):
            count += 1
            if r['trip_id'] in trips:
                calls[r['trip_id']].append([r['stop_id'], seconds(r['arrival_time'] or r['departure_time']), seconds(r['departure_time'] or r['arrival_time']), r.get('pickup_type') or '0', r.get('drop_off_type') or '0', int(r['stop_sequence'])])
            if count % 10000000 == 0: print(f'Scanned {count:,} national stop-time rows', flush=True)
    assert count == inventory['metadata']['sourceRows']['stopTimes']
    active = {sid: service_dates(calendars.get(sid), exceptions[sid], first, last) for sid in sorted(services)}
    route_days, witnesses, retained = defaultdict(Counter), {}, []
    route_counts = Counter()
    sampled = {d['date'] for d in summary['days']}
    for ident, t in sorted(trips.items()):
        chain = sorted(calls[ident], key=lambda c: c[5])
        if not any(c[0] in inside for c in chain): continue
        route_counts[t['route_id']] += 1
        assert len(chain) >= 2
        for i, c in enumerate(chain):
            assert c[2] >= c[1] and (not i or (c[5] > chain[i-1][5] and c[1] >= chain[i-1][2]))
        start, end = chain[0][2], chain[-1][1]
        assert start < 172800 and end < 172800, 'Review multi-day service before admission'
        uses = civil_dates(active[t['service_id']], start, end, first, last)
        route = source_routes[t['route_id']]
        train = dict(sourceTripId=ident, serviceId=t['service_id'], routeId=t['route_id'], agencyId=routes[t['route_id']]['agency_id'], route=route['line'] or route['longName'] or route['mode'], category=route['mode'], directionId=t.get('direction_id', ''), headsign=t.get('trip_headsign', ''), shortName=t.get('trip_short_name', ''), start=start, end=end, calls=[c[:5] for c in chain], activeServiceDates=[d.isoformat() for d in active[t['service_id']]])
        retained.append(train)
        for day, service_day, offset in uses:
            assert day not in sampled, f'Target route unexpectedly active in existing sample: {t["route_id"]} {day}'
            route_days[t['route_id']][day] += 1
            key = (t['route_id'], day)
            witness = dict(sourceTripId=ident, sourceServiceDate=service_day, serviceOffset=offset, directionId=train['directionId'], shortName=train['shortName'], callCount=len(chain), firstStopId=chain[0][0], lastStopId=chain[-1][0])
            if key not in witnesses: witnesses[key] = witness
    for rid in targets:
        assert route_counts[rid] == source_routes[rid]['cantonSourceTrips']
        assert sum(t['route_id'] == rid for t in trips.values()) == source_routes[rid]['totalSourceTrips']
    selection = greedy_dates({rid: route_days[rid] for rid in targets})
    records = []
    for rid in sorted(targets):
        r = source_routes[rid]; days = route_days[rid]
        selected = [s['date'] for s in selection if rid in s['newlyWitnessedRoutes']]
        records.append(dict(routeId=rid, agencyId=r['agencyId'], operator=r['operator'], line=r['line'], mode=r['mode'], archivedCantonTrips=route_counts[rid], activeCivilDates=[dict(date=d, journeys=n) for d,n in sorted(days.items())], witnessDate=selected[0] if selected else None, witness=witnesses[(rid, selected[0])] if selected else None, status='witness-found' if selected else 'no-active-canton-journey-in-pinned-feed-year'))
    used = {c[0] for t in retained for c in t['calls']}
    payload = dict(schemaVersion=1, archiveSha256=summary['archiveSha256'], stops=[stops[s] for s in sorted(used)], trains=retained,
        calendars=[calendars[s] for s in sorted(calendars)], exceptions=[r for s in sorted(exceptions) for r in exceptions[s]])
    encoded = (json.dumps(payload, separators=(',', ':'), ensure_ascii=False)+'\n').encode()
    packed = gzip.compress(encoded, mtime=0)
    report = dict(schemaVersion=1, checkedOn='2026-09-08', archiveSha256=summary['archiveSha256'], archiveUrl=inventory['metadata']['archiveUrl'], feed=feeds[0], sourceStopTimeRows=count,
        inputHashes={str(summary_file):sha(summary_file),str(inventory_file):sha(inventory_file)}, sourcePatternsFile='source-patterns.json.gz', sourcePatternsSha256=hashlib.sha256(packed).hexdigest(),
        scope='Exhaustive calendar and exception search for the 45 routes absent from the twelve-date sample, retaining only complete trips with a pinned Aargau call. Archived schedule evidence, not actual operation or publication admission. Civil-day membership uses selected and preceding service dates, matching the importer.',
        attribution=['Timetable data: opentransportdata.swiss / SKI; original publisher attribution retained in the canton inventory.', 'Canton membership: Daten des Kantons Aargau'],
        selectionMethod='Deterministic greedy cover: most newly witnessed route records, then earliest civil date. This is a compact cover, not a proof of the minimum number of dates.',
        targetRoutes=len(targets), witnessedRoutes=sum(bool(r['witness']) for r in records), noActiveWitnessRoutes=[r['routeId'] for r in records if not r['witness']],
        archivedCantonTrips=len(retained), calendarServices=len(services), selectedDates=selection, routes=records, publicationReady=False)
    text=json.dumps(report,indent=2,ensure_ascii=False)+'\n'
    if args.check:
        assert json.loads((root/'inventory.json').read_text()) == report
        assert gzip.decompress((root/'source-patterns.json.gz').read_bytes()) == encoded
        assert sha(root/'source-patterns.json.gz') == report['sourcePatternsSha256']
    else:
        root.mkdir(parents=True,exist_ok=True)
        (root/'source-patterns.json.gz').write_bytes(packed)
        (root/'inventory.json').write_text(text)
    print(json.dumps({k:report[k] for k in ('targetRoutes','witnessedRoutes','noActiveWitnessRoutes','archivedCantonTrips','selectedDates')},indent=2),flush=True)

if __name__ == '__main__': main()
