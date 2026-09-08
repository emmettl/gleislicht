import { test, expect } from 'vitest'
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { inventoryAargau, hashFile } from './inventory-aargau.mjs'

test('whole-archive membership, Sunday carry-in, calendar exception, frequency expansion and full border chains', async () => {
  const dir = await mkdtemp(join(tmpdir(),'aargau-test-'))
  try {
    const sources = join(dir,'sources'); await mkdir(sources)
    const boundary = {type:'MultiPolygon',coordinates:[[[[8,47],[8.2,47],[8.2,47.2],[8,47.2],[8,47]]]]}
    await writeFile(join(sources,'boundary.json'),JSON.stringify(boundary))
    await writeFile(join(sources,'sources.json'),JSON.stringify({boundary:{cantonNumber:19},files:{'boundary.json':{sha256:await hashFile(join(sources,'boundary.json'))}}}))
    const files = {
      'feed_info.txt':'feed_publisher_name,feed_version,feed_start_date,feed_end_date\nTest,test,20260101,20261231\n',
      'agency.txt':'agency_id,agency_name\n1,Regional\n2,Seasonal\n3,Outside\n',
      'routes.txt':'route_id,agency_id,route_short_name,route_long_name,route_type\nr,1,1,,700\ns,2,2,,700\nout,3,3,,700\n',
      'stops.txt':'stop_id,stop_name,stop_lon,stop_lat\nA,Inside,8.1,47.1\nB,Outside,9,48\n',
      'trips.txt':'route_id,service_id,trip_id,direction_id,trip_headsign,trip_short_name\nr,sat,night,0,,\nr,sun,removed,0,,\nr,added,frequency,1,,\ns,season,seasonal,0,,\nout,sat,outside,0,,\n',
      'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nsat,0,0,0,0,0,1,0,20260101,20261231\nsun,0,0,0,0,0,0,1,20260101,20261231\nseason,1,1,1,1,1,1,1,20260101,20260131\n',
      'calendar_dates.txt':'service_id,date,exception_type\nsun,20260906,2\nadded,20260906,1\n',
      'frequencies.txt':'trip_id,start_time,end_time,headway_secs,exact_times\nfrequency,12:00:00,13:00:00,1800,0\n',
      'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\nnight,24:10:00,24:10:00,B,1,0,0\nnight,24:30:00,24:30:00,A,2,0,0\nremoved,10:00:00,10:00:00,A,1,0,0\nremoved,10:30:00,10:30:00,B,2,0,0\nfrequency,00:00:00,00:00:00,A,1,2,0\nfrequency,00:10:00,00:10:00,B,2,0,0\nseasonal,10:00:00,10:00:00,A,1,0,0\nseasonal,10:30:00,10:30:00,B,2,0,0\noutside,10:00:00,10:00:00,B,1,0,0\noutside,10:30:00,10:30:00,B,2,0,0\n',
    }
    for (const [name,content] of Object.entries(files)) await writeFile(join(dir,name),content)
    const archive = join(dir,'test.zip'); execFileSync('zip',['-q',archive,...Object.keys(files)],{cwd:dir})
    const output=join(dir,'output')
    const inventory=await inventoryAargau({archive,sources,dates:['2026-09-06'],output})
    const raw=JSON.parse(gunzipSync(await readFile(join(output,'2026-09-06-timetable.json.gz'))))
    expect(raw.trains).toHaveLength(3)
    expect(raw.trains.find(t=>t.sourceTripId==='night')).toMatchObject({sourceServiceDate:'2026-09-05',start:600,end:1800})
    expect(raw.trains.find(t=>t.sourceTripId==='night').calls.map(c=>c[0])).toEqual(['B','A'])
    expect(raw.trains.filter(t=>t.frequency).map(t=>t.start)).toEqual([43200,45000])
    expect(raw.trains.filter(t=>t.frequency).every(t=>t.calls[0][3]==='2')).toBe(true)
    expect(inventory.routes.find(r=>r.routeId==='s').admission).toBe('inventoried-inactive-on-selected-dates')
    expect(inventory.routes.find(r=>r.routeId==='out').admission).toBe('excluded-no-canton-call')
  } finally { await rm(dir,{recursive:true,force:true}) }
})
