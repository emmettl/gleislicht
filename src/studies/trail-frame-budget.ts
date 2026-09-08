/** Give moving markers priority when the browser cannot sustain smooth frames. */
export class TrailFrameBudget {
  private averageFrame = 1 / 60
  private recoverySeconds = 0
  private reduced = false

  interval(delta: number): number {
    // A background-tab resume is not a sustained rendering problem.
    if (Number.isFinite(delta) && delta > 0 && delta < 0.25) {
      const weight = 1 - Math.exp(-delta / 0.35)
      this.averageFrame += (delta - this.averageFrame) * weight
      if (!this.reduced && this.averageFrame > 1 / 40) {
        this.reduced = true
        this.recoverySeconds = 0
      } else if (this.reduced) {
        this.recoverySeconds = this.averageFrame < 1 / 52 ? this.recoverySeconds + delta : 0
        if (this.recoverySeconds >= 3) this.reduced = false
      }
    }
    return this.reduced ? 1 / 15 : 1 / 30
  }
}
