/** Reduce fill rate before changing the user's chosen terrain or visual effects. */
export class OrbitalResolutionBudget {
  private slow = 0
  private fast = 0
  private cooldown = 3

  sample(delta: number, current: number, maximum: number): number {
    // Ignore loading stalls and background-tab gaps, not sustained slow frames.
    if (!Number.isFinite(delta) || delta <= 0 || delta >= 1) return current
    this.cooldown = Math.max(0, this.cooldown - delta)
    this.slow = delta > 1 / 42 ? this.slow + delta : Math.max(0, this.slow - delta)
    this.fast = delta < 1 / 55 ? this.fast + delta : 0
    const next = this.cooldown > 0 ? current
      : this.slow >= 2 ? Math.max(0.75, current - 0.25)
      : this.fast >= 10 ? Math.min(maximum, current + 0.25) : current
    if (next !== current) {
      this.slow = 0; this.fast = 0; this.cooldown = 5
    }
    return next
  }
}

/** Static terrain needs a new shadow only after the sun moves appreciably. */
export class OrbitalShadowBudget {
  private time = NaN
  private terrain: unknown

  shouldUpdate(time: number, terrain: unknown, daylight: boolean): boolean {
    if (!daylight) { this.time = NaN; return false }
    if (terrain !== this.terrain || !Number.isFinite(this.time) || Math.abs(time - this.time) >= 30) {
      this.time = time; this.terrain = terrain; return true
    }
    return false
  }
}
