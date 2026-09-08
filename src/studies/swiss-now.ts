import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
const swissClock = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
export function swissInstant(instant: Date) {
  const p = Object.fromEntries(swissClock.formatToParts(instant).map(part => [part.type, part.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) + Math.floor(instant.getMilliseconds() / 100) / 10 }
}
/** Same season and weekday/weekend class is a representative timetable, never a live observation. */
export function resolveSwissNow(instant: Date, metadata?: NetworkSnapshot['metadata']): number | null {
  if (!metadata) return null
  const { date, time } = swissInstant(instant)
  const source = new Date(`${metadata.serviceDate}T12:00:00Z`)
  const target = new Date(`${date}T12:00:00Z`)
  const dayClass = (d: Date) => d.getUTCDay() === 0 ? 0 : d.getUTCDay() === 6 ? 6 : 1
  if (!Number.isFinite(source.getTime()) || dayClass(source) !== dayClass(target) || Math.abs(target.getTime() - source.getTime()) > 31 * 86400000) return null
  return time >= metadata.windowStart && time < metadata.windowEnd ? time : null
}
