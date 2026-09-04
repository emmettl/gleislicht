import * as THREE from 'three'

export function createGlowPointTexture(): THREE.CanvasTexture {
  const size = 64
  const centre = size / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (context) {
    const glow = context.createRadialGradient(
      centre,
      centre,
      0,
      centre,
      centre,
      centre,
    )
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)')
    glow.addColorStop(0.22, 'rgba(255, 255, 255, 1)')
    glow.addColorStop(0.48, 'rgba(255, 255, 255, 0.62)')
    glow.addColorStop(0.76, 'rgba(255, 255, 255, 0.18)')
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = glow
    context.fillRect(0, 0, size, size)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}
