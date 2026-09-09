/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { vi } from 'vitest'

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(`${process.cwd()}/public/data/${name}`, 'utf8')) as T
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
export function fixtureFetch() {
  const overrides = new Map<string, (init?: RequestInit) => Response | Promise<Response>>()
  const requests: string[] = []
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(typeof input === 'object' && 'url' in input ? input.url : String(input), 'http://localhost').pathname.replace(/^.*\/data\//, '')
    requests.push(path)
    if (overrides.has(path)) return overrides.get(path)!(init)
    const bytes = readFileSync(`${process.cwd()}/public/data/${path}`)
    return new Response(bytes, { headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetcher)
  return { requests, overrides, fetcher }
}
