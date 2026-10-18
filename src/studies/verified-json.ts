interface IntegrityDescriptor {
  readonly bytes: number
  readonly sha256: string
}
interface VerifiedJsonOptions<T> {
  readonly signal: AbortSignal
  readonly parse: (value: unknown) => T
  readonly errors: { readonly unavailable: string; readonly integrity: string }
}

/** One request, with verification before decoding and caller-owned schema validation.
 * No cache or automatic retries: request identity and visible state stay with callers.
 */
export async function loadVerifiedJson<T>(url: string, descriptor: IntegrityDescriptor,
  { signal, parse, errors }: VerifiedJsonOptions<T>): Promise<T> {
  signal.throwIfAborted()
  if (!Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1 || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
    throw new Error(errors.integrity)
  }
  const response = await fetch(url, { signal })
  signal.throwIfAborted()
  if (!response.ok) throw new Error(errors.unavailable)
  const bytes = await response.arrayBuffer()
  signal.throwIfAborted()
  if (bytes.byteLength !== descriptor.bytes) throw new Error(errors.integrity)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  signal.throwIfAborted()
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  if (hash !== descriptor.sha256) throw new Error(errors.integrity)
  const value = parse(JSON.parse(new TextDecoder().decode(bytes)))
  signal.throwIfAborted()
  return value
}
