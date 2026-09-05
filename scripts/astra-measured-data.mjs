const SOAP_ENDPOINT =
  'https://api.opentransportdata.swiss/TDP/Soap_Datex2/Pull'
const SOAP_ACTION =
  'http://opentransportdata.swiss/TDP/Soap_Datex2/Pull/v1/pullMeasuredData'

function escapeXmlAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}

function textValue(xml, localName) {
  return xml.match(
    new RegExp(`<(?:[\\w-]+:)?${localName}\\b[^>]*>([^<]*)<\\/(?:[\\w-]+:)?${localName}>`),
  )?.[1]?.trim()
}

function numericValue(xml, localName) {
  const value = Number(textValue(xml, localName))
  return Number.isFinite(value) ? value : undefined
}

export function buildMeasuredDataRequest(siteReferences, requestedAt) {
  const references = siteReferences
    .map(
      (id) =>
        `<dx223:siteRequestReference xsi:type="dx223:_MeasurementSiteRecordVersionedReference" targetClass="MeasurementSiteRecord" id="${escapeXmlAttribute(id)}" version="0"/>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:dx223="http://datex2.eu/schema/2/2_0"><SOAP-ENV:Body><dx223:d2LogicalModel modelBaseVersion="2"><dx223:exchange><dx223:supplierIdentification><dx223:country>ch</dx223:country><dx223:nationalIdentifier>Gleislicht</dx223:nationalIdentifier></dx223:supplierIdentification></dx223:exchange><dx223:payloadPublication xsi:type="dx223:GenericPublication" lang="en"><dx223:publicationTime>${requestedAt}</dx223:publicationTime><dx223:publicationCreator><dx223:country>ch</dx223:country><dx223:nationalIdentifier>Gleislicht</dx223:nationalIdentifier></dx223:publicationCreator><dx223:genericPublicationName>MeasuredDataFilter</dx223:genericPublicationName><dx223:genericPublicationExtension><dx223:measuredDataFilter><dx223:measurementSiteTableReference xsi:type="dx223:_MeasurementSiteTableVersionedReference" targetClass="MeasurementSiteTable" id="OTD:TrafficData" version="0"/>${references}</dx223:measuredDataFilter></dx223:genericPublicationExtension></dx223:payloadPublication></dx223:d2LogicalModel></SOAP-ENV:Body></SOAP-ENV:Envelope>`
}

export function parseMeasuredData(xml, receivedAt = new Date().toISOString()) {
  const fault = textValue(xml, 'faultstring')
  if (fault) throw new Error(`ASTRA SOAP fault: ${fault}`)

  const publicationTime = textValue(xml, 'publicationTime')
  const tableReference = xml.match(
    /<(?:[\w-]+:)?measurementSiteTableReference\b[^>]*\bversion="(\d+)"[^>]*>/,
  )
  const siteBlocks = [
    ...xml.matchAll(
      /<(?:[\w-]+:)?siteMeasurements\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?siteMeasurements>/g,
    ),
  ]

  const measurements = siteBlocks.flatMap(([, block]) => {
    const siteId = block.match(
      /<(?:[\w-]+:)?measurementSiteReference\b[^>]*\bid="([^"]+)"[^>]*>/,
    )?.[1]
    const measurementTime = textValue(block, 'measurementTimeDefault')
    if (!siteId || !measurementTime) return []
    const values = {}
    for (const match of block.matchAll(
      /<(?:[\w-]+:)?measuredValue\b[^>]*\bindex="(\d+)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?measuredValue>/g,
    )) {
      const index = Number(match[1])
      const value =
        index === 11 || index === 21
          ? numericValue(match[2], 'vehicleFlowRate')
          : index === 12 || index === 22
            ? numericValue(match[2], 'speed')
            : undefined
      if (value !== undefined) values[index] = value
    }
    return [
      {
        siteId,
        measurementTime: new Date(measurementTime).toISOString(),
        lightFlowPerHour: values[11],
        lightSpeedKmh: values[12],
        heavyFlowPerHour: values[21],
        heavySpeedKmh: values[22],
      },
    ]
  })

  if (!publicationTime || !measurements.length) {
    throw new Error('ASTRA response contains no usable measured data')
  }

  return {
    metadata: {
      publisher: 'Federal Roads Office (ASTRA / FEDRO)',
      publicationTime: new Date(publicationTime).toISOString(),
      receivedAt,
      measurementSiteTableVersion: tableReference
        ? Number(tableReference[1])
        : undefined,
      measurementKind: 'recorded',
      sourceUrl: SOAP_ENDPOINT,
    },
    measurements,
  }
}

export function validateMeasuredData(snapshot) {
  const publicationTime = Date.parse(snapshot.metadata.publicationTime)
  const receivedAt = Date.parse(snapshot.metadata.receivedAt)
  if (!Number.isFinite(publicationTime) || !Number.isFinite(receivedAt)) {
    throw new Error('ASTRA response has invalid publication or receipt time')
  }
  const siteIds = new Set()
  let newestMeasurementTime = -Infinity
  for (const measurement of snapshot.measurements) {
    if (siteIds.has(measurement.siteId)) {
      throw new Error(`ASTRA response repeats detector ${measurement.siteId}`)
    }
    siteIds.add(measurement.siteId)
    const measurementTime = Date.parse(measurement.measurementTime)
    if (!Number.isFinite(measurementTime) || measurementTime % 60_000 !== 0) {
      throw new Error(`ASTRA detector ${measurement.siteId} has an invalid minute timestamp`)
    }
    newestMeasurementTime = Math.max(newestMeasurementTime, measurementTime)
    for (const [name, value] of Object.entries(measurement)) {
      if (name.endsWith('PerHour') || name.endsWith('Kmh')) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
          throw new Error(`ASTRA detector ${measurement.siteId} has invalid ${name}`)
        }
      }
    }
  }
  const publicationLag = publicationTime - newestMeasurementTime
  const receiptLag = receivedAt - publicationTime
  if (publicationLag < 0 || publicationLag > 180_000) {
    throw new Error('ASTRA publication is stale or predates its measurement minute')
  }
  if (receiptLag < -30_000 || receiptLag > 180_000) {
    throw new Error('ASTRA publication is stale relative to recorder receipt time')
  }
  return snapshot
}

export async function pullMeasuredData({
  apiKey,
  siteReferences,
  signal,
  fetchImpl = fetch,
  now = new Date(),
}) {
  if (!apiKey) throw new Error('ASTRA_API_KEY is required')
  if (!siteReferences.length) throw new Error('At least one ASTRA site filter is required')
  const requestedAt = now.toISOString()
  const response = await fetchImpl(SOAP_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: SOAP_ACTION,
    },
    body: buildMeasuredDataRequest(siteReferences, requestedAt),
    signal,
  })
  const xml = await response.text()
  if (!response.ok) {
    throw new Error(`ASTRA request failed with HTTP ${response.status}`)
  }
  const snapshot = parseMeasuredData(xml, now.toISOString())
  return { xml, snapshot: validateMeasuredData(snapshot) }
}

export const ASTRA_SOAP_ENDPOINT = SOAP_ENDPOINT
export const ASTRA_SOAP_ACTION = SOAP_ACTION
