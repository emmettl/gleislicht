import { Matrix4, type Camera } from 'three'

/** Keep label motion at frame rate while bounding full-network label searches. */
export class LabelFrameBudget {
  private key?: object
  private projection = new Matrix4()
  private view = new Matrix4()
  private width = 0
  private height = 0
  private elapsed = 0
  private time = NaN

  update(key: object, camera: Camera, width: number, height: number, time: number,
    delta: number, playing: boolean, rate: number): 'all' | 'visible' | 'idle' {
    const changed = this.key !== key || width !== this.width || height !== this.height ||
      !this.projection.equals(camera.projectionMatrix) || !this.view.equals(camera.matrixWorldInverse)
    const advanced = time - this.time
    const seek = playing
      ? advanced < 0 || Math.abs(advanced - delta * rate) > Math.max(1, Math.abs(delta * rate) * 0.5)
      : advanced !== 0
    this.time = time
    this.elapsed += Math.max(0, delta)
    if (changed || seek || playing && this.elapsed >= 0.1) {
      this.key = key
      this.projection.copy(camera.projectionMatrix)
      this.view.copy(camera.matrixWorldInverse)
      this.width = width
      this.height = height
      this.elapsed = 0
      return 'all'
    }
    return playing ? 'visible' : 'idle'
  }
}
