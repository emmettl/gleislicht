// @vitest-environment jsdom
import './dom.ts'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import GenevaLuzernStatistics from '../studies/GenevaLuzernStatistics.tsx'

const path = 'public/data/geneva-luzern-statistics/'
const index = readFileSync(path + 'index.json', 'utf8')
const geneva = readFileSync(path + 'geneva.json', 'utf8')
const luzern = readFileSync(path + 'luzern.json', 'utf8')
const profile = JSON.parse(luzern).profile.name as string

it('does not replace the current region with an obsolete response that ignores abort', async () => {
  let release!: (response: Response) => void
  const late = new Promise<Response>(resolve => { release = resolve })
  let obsolete: AbortSignal | null | undefined
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/index.json')) return Promise.resolve(new Response(index))
    if (url.endsWith('/geneva.json')) { obsolete = options?.signal; return late }
    if (url.endsWith('/luzern.json')) return Promise.resolve(new Response(luzern))
    throw new Error('Unexpected asset: ' + url)
  }))
  render(<GenevaLuzernStatistics language="en" />)
  await vi.waitFor(() => expect(obsolete).toBeDefined())
  fireEvent.change(screen.getByRole('combobox', { name: 'Region' }), { target: { value: 'luzern' } })
  await screen.findByRole('heading', { name: profile })
  expect(obsolete?.aborted).toBe(true)
  await act(async () => { release(new Response(geneva)); await late })
  expect(screen.getByRole('heading', { name: profile })).toBeTruthy()
  expect((screen.getByRole('combobox', { name: 'Region' }) as HTMLSelectElement).value).toBe('luzern')
  expect(screen.queryByRole('alert')).toBeNull()
})

it('keeps the existing error copy and explicitly retries a corrupt payload', async () => {
  let attempts = 0
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/index.json')) return Promise.resolve(new Response(index))
    if (url.endsWith('/geneva.json')) {
      attempts++
      return Promise.resolve(new Response(attempts === 1 ? geneva.replace('geneva', 'luzern') : geneva))
    }
    throw new Error('Unexpected asset: ' + url)
  }))
  render(<GenevaLuzernStatistics language="en" />)
  expect((await screen.findByRole('alert')).textContent).toContain('Statistics could not be loaded.')
  expect(attempts).toBe(1)
  expect(screen.queryByRole('combobox', { name: 'Counter' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('combobox', { name: 'Counter' })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(attempts).toBe(2)
})
