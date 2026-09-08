// NOAA's approximate solar-position equations, using east-positive longitude:
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
const RAD = Math.PI / 180
// A composite timetable needs one explicit lighting date. Switzerland is on
// CEST on this date; the offset is independent of the browser's time zone.
export const ORBITAL_SOLAR_MIDNIGHT = Date.parse('2026-09-08T00:00:00+02:00')

export function solarPosition(instant: number, latitude = 46.8, longitude = 8.23) {
  const date = new Date(instant), year = date.getUTCFullYear()
  const yearStart = Date.UTC(year, 0, 1), yearEnd = Date.UTC(year + 1, 0, 1)
  const days = (yearEnd - yearStart) / 86400000
  const gamma = 2 * Math.PI / days * ((instant - yearStart) / 86400000 - 0.5)
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000
  const hourAngle = ((minutes + equation + longitude * 4) / 4 - 180) * RAD
  const lat = latitude * RAD
  const east = -Math.cos(declination) * Math.sin(hourAngle)
  const north = Math.cos(lat) * Math.sin(declination) - Math.sin(lat) * Math.cos(declination) * Math.cos(hourAngle)
  const up = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)
  return {
    altitude: Math.asin(Math.max(-1, Math.min(1, up))) / RAD,
    azimuth: (Math.atan2(east, north) / RAD + 360) % 360,
    // Orbital world axes: x east, y up, z south.
    direction: [east, up, -north] as [number, number, number],
  }
}

export const orbitalSun = (seconds: number) => solarPosition(ORBITAL_SOLAR_MIDNIGHT + seconds * 1000)
