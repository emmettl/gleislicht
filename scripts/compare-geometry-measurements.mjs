import assert from 'node:assert/strict'

// Derived metre measurements can differ in the last binary digits across
// libm/V8 platforms. Source coordinates, identities and admission decisions
// still require exact equality; no source or delivered geometry is rewritten.
export function assertGeometryMeasurementsEqual(actual, expected, key = '', path = '$') {
  const measured = key.endsWith('Metres')
  if (measured && typeof actual === 'number' && typeof expected === 'number') {
    assert(Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= 1e-7, `Geometry measurement changed: ${path}`)
  } else if (Array.isArray(actual) && Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, `Geometry array changed: ${path}`)
    actual.forEach((value, i) => assertGeometryMeasurementsEqual(value, expected[i], key, `${path}[${i}]`))
  } else if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `Geometry fields changed: ${path}`)
    for (const field of Object.keys(actual)) assertGeometryMeasurementsEqual(actual[field], expected[field], field, `${path}.${field}`)
  } else assert.deepEqual(actual, expected, `Geometry evidence changed: ${path}`)
}
