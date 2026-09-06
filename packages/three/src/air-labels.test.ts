import { describe, expect, it } from 'vitest'
import {
  airLabelBudget,
  airLabelScreenHeight,
  airLabelScreenWidth,
  compareAirLabelCandidates,
  MAX_AIR_LABELS,
} from './air-labels.ts'

describe('air labels', () => {
  it('keeps the automatic sky quieter than the rail label layer', () => {
    expect(airLabelBudget(37, 'auto', false)).toBe(4)
    expect(airLabelBudget(25, 'auto', false)).toBe(7)
    expect(airLabelBudget(14, 'auto', false)).toBe(10)
  })

  it('offers a denser explicit layer and honours off for selections', () => {
    expect(airLabelBudget(37, 'on', false)).toBe(8)
    expect(airLabelBudget(14, 'on', false)).toBe(MAX_AIR_LABELS)
    expect(airLabelBudget(37, 'auto', true)).toBe(1)
    expect(airLabelBudget(14, 'off', true)).toBe(0)
  })

  it('retains visible callsigns and prefers callsigns over fallback ids', () => {
    const candidates = [
      { id: 'abc123', callsign: 'ABC123', retained: false },
      { id: 'def456', callsign: 'SWR18K', retained: false },
      { id: 'ghi789', callsign: 'EZY92LP', retained: true },
    ]

    expect([...candidates].sort(compareAirLabelCandidates).map(({ id }) => id)).toEqual([
      'ghi789',
      'def456',
      'abc123',
    ])
  })

  it('keeps phone labels restrained while preserving a selected callsign', () => {
    expect(airLabelScreenHeight(390, false, 37)).toBe(18)
    expect(airLabelScreenHeight(390, true, 37)).toBe(26)
    expect(airLabelScreenHeight(390, false, 14)).toBe(26)
    expect(airLabelScreenHeight(1024, false, 37)).toBe(28)
    expect(airLabelScreenWidth('SWR18K', 18)).toBeGreaterThanOrEqual(39)
  })
})
