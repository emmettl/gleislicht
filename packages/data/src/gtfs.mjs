import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }

  values.push(value)
  return values
}

export function parseGtfsTime(value) {
  const [hours, minutes, seconds] = value.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

function compactDate(value) {
  return value.replaceAll('-', '')
}

export function weekdayField(date) {
  return [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][new Date(`${date}T12:00:00Z`).getUTCDay()]
}

export function transportModeForRouteType(value) {
  const routeType = Number(value)
  if (routeType === 0 || (routeType >= 900 && routeType < 1000)) return 'tram'
  if (routeType === 1 || (routeType >= 400 && routeType < 500)) return 'metro'
  if (routeType === 2 || (routeType >= 100 && routeType < 200)) return 'rail'
  if (
    routeType === 3 ||
    routeType === 11 ||
    (routeType >= 200 && routeType < 300) ||
    (routeType >= 700 && routeType < 800)
  ) return 'bus'
  if (routeType === 4 || (routeType >= 1000 && routeType < 1100)) return 'ferry'
  if (routeType === 6 || (routeType >= 1300 && routeType < 1400)) {
    return 'cableway'
  }
  if (routeType === 7 || (routeType >= 1400 && routeType < 1500)) {
    return 'funicular'
  }
  return undefined
}

export async function* rowsFromArchive(archive, fileName) {
  const child = spawn('unzip', ['-p', archive, fileName], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let standardError = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    standardError += chunk
  })
  const completed = new Promise((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise)
    child.once('close', (code) => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(`unzip ${fileName} failed: ${standardError.trim()}`))
    })
  })

  // Observe rejection immediately; the generator may still be consuming stdout.
  void completed.catch(() => {})
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  try {
  let headers
  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line.replace(/^\uFEFF/, ''))
      continue
    }
    const values = parseCsvLine(line)
    const row = Object.create(null)
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = values[index] ?? ''
    }
    yield row
  }
  await completed
  } finally {
    lines.close()
    if (child.exitCode === null) child.kill()
    await completed.catch(() => {})
  }
}

export async function activeServices(archive, serviceDate) {
  const date = compactDate(serviceDate)
  const weekday = weekdayField(serviceDate)
  const services = new Set()

  for await (const row of rowsFromArchive(archive, 'calendar.txt')) {
    if (row.start_date <= date && row.end_date >= date && row[weekday] === '1') {
      services.add(row.service_id)
    }
  }

  for await (const row of rowsFromArchive(archive, 'calendar_dates.txt')) {
    if (row.date !== date) continue
    if (row.exception_type === '1') services.add(row.service_id)
    if (row.exception_type === '2') services.delete(row.service_id)
  }

  return services
}

export async function stopsById(archive) {
  const stops = new Map()
  for await (const row of rowsFromArchive(archive, 'stops.txt')) {
    const latitude = Number(row.stop_lat)
    const longitude = Number(row.stop_lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    stops.set(row.stop_id, {
      name: row.stop_name,
      latitude,
      longitude,
      platformCode: row.platform_code,
    })
  }
  return stops
}
