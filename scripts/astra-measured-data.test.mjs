import { describe, expect, it, vi } from 'vitest'
import {
  ASTRA_SOAP_ACTION,
  ASTRA_SOAP_ENDPOINT,
  buildMeasuredDataRequest,
  parseMeasuredData,
  pullMeasuredData,
  validateMeasuredData,
} from './astra-measured-data.mjs'

const responseXml = `<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dx223="http://datex2.eu/schema/2/2_0"><SOAP-ENV:Body><dx223:d2LogicalModel><dx223:payloadPublication><dx223:publicationTime>2026-09-05T06:46:20Z</dx223:publicationTime><dx223:measurementSiteTableReference id="OTD:TrafficData" version="23"/><dx223:siteMeasurements><dx223:measurementSiteReference id="CH:0612.01" version="1"/><dx223:measurementTimeDefault>2026-09-05T06:45:00Z</dx223:measurementTimeDefault><dx223:measuredValue index="11"><dx223:measuredValue><dx223:vehicleFlowRate>1200</dx223:vehicleFlowRate></dx223:measuredValue></dx223:measuredValue><dx223:measuredValue index="12"><dx223:measuredValue><dx223:speed>76.5</dx223:speed></dx223:measuredValue></dx223:measuredValue><dx223:measuredValue index="21"><dx223:measuredValue><dx223:vehicleFlowRate>60</dx223:vehicleFlowRate></dx223:measuredValue></dx223:measuredValue><dx223:measuredValue index="22"><dx223:measuredValue><dx223:speed>67</dx223:speed></dx223:measuredValue></dx223:measuredValue></dx223:siteMeasurements></dx223:payloadPublication></dx223:d2LogicalModel></SOAP-ENV:Body></SOAP-ENV:Envelope>`

describe('ASTRA measured-data recorder', () => {
  it('builds a filtered DATEX II SOAP request', () => {
    const body = buildMeasuredDataRequest(
      ['CH:0612/#', 'CH:0208/#'],
      '2026-09-05T06:46:20.000Z',
    )
    expect(body).toContain('MeasuredDataFilter')
    expect(body).toContain('id="CH:0612/#"')
    expect(body).toContain('id="CH:0208/#"')
    expect(body).toContain('id="OTD:TrafficData" version="0"')
  })

  it('normalises the four published light and heavy measurements', () => {
    const snapshot = parseMeasuredData(responseXml, '2026-09-05T06:46:21Z')
    expect(snapshot.metadata).toMatchObject({
      measurementSiteTableVersion: 23,
      measurementKind: 'recorded',
    })
    expect(snapshot.measurements).toEqual([
      {
        siteId: 'CH:0612.01',
        measurementTime: '2026-09-05T06:45:00.000Z',
        lightFlowPerHour: 1200,
        lightSpeedKmh: 76.5,
        heavyFlowPerHour: 60,
        heavySpeedKmh: 67,
      },
    ])
  })

  it('sends the required endpoint, bearer token and SOAP action', async () => {
    const fetchImpl = vi.fn(async () => new Response(responseXml))
    await pullMeasuredData({
      apiKey: 'secret-test-key',
      siteReferences: ['CH:0612/#'],
      fetchImpl,
      now: new Date('2026-09-05T06:46:20Z'),
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      ASTRA_SOAP_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-test-key',
          SOAPAction: ASTRA_SOAP_ACTION,
        }),
      }),
    )
  })

  it('rejects SOAP faults and empty publications', () => {
    expect(() =>
      parseMeasuredData('<Envelope><faultstring>PRV_OFFLINE</faultstring></Envelope>'),
    ).toThrow('PRV_OFFLINE')
    expect(() => parseMeasuredData('<Envelope/>')).toThrow('no usable measured data')
  })

  it('rejects stale or repeated detector measurements before recording', () => {
    const snapshot = parseMeasuredData(responseXml, '2026-09-05T06:50:00Z')
    expect(() => validateMeasuredData(snapshot)).toThrow('stale relative')
    snapshot.metadata.receivedAt = '2026-09-05T06:46:21Z'
    snapshot.measurements.push({ ...snapshot.measurements[0] })
    expect(() => validateMeasuredData(snapshot)).toThrow('repeats detector')
  })
})
