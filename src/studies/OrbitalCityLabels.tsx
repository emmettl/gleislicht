/* oxlint-disable react/immutability -- Projected label DOM and pointer state are updated in the render loop. */
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { createOrbitalPointer } from './orbital-pointer.ts'
import { ORBITAL_PLACES } from './orbital-places.ts'
import { orbitalXZ, type OrbitalSurface } from './orbital-terrain.ts'

export default function OrbitalCityLabels({ surface, root }: { surface: OrbitalSurface; root: RefObject<HTMLDivElement | null> }) {
  const { camera, gl, size } = useThree()
  const pointer = useRef(createOrbitalPointer())
  const nodes = useRef<HTMLDivElement[]>([])
  const selected = useRef(-1)
  const projected = useMemo(() => new Vector3(), [])
  const anchors = useMemo(() => ORBITAL_PLACES.map(([name, lon, lat]) => {
    const [x, z] = orbitalXZ(lon, lat)
    return { name, point: new Vector3(x, surface.height(x, z) + 0.06, z) }
  }), [surface])
  useEffect(() => {
    const container = root.current
    if (!container) return
    const labels = anchors.map(({ name }) => {
      const node = document.createElement('div')
      node.className = 'orbital-city-label'; node.textContent = name
      const marker = document.createElement('span')
      marker.className = 'orbital-city-marker'
      node.appendChild(marker)
      container.appendChild(node)
      return node
    })
    nodes.current = labels
    return () => { labels.forEach(node => node.remove()); nodes.current = [] }
  }, [anchors, root])
  useEffect(() => {
    const canvas = gl.domElement, controller = pointer.current
    const sample = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top
      return { id: event.pointerId, type: event.pointerType, x, y, inside: x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height }
    }
    const move = (event: PointerEvent) => controller.move(sample(event))
    const leave = (event: PointerEvent) => controller.leave(event.pointerType)
    const down = (event: PointerEvent) => controller.down(sample(event))
    const up = (event: PointerEvent) => controller.up(sample(event), performance.now())
    const cancel = () => controller.cancel()
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('pointerdown', down); window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel)
    return () => {
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel)
    }
  }, [gl])
  useFrame(() => {
    const mouse = pointer.current.state
    let nearest = -1, distance = mouse.touch ? 32 : 24
    if (mouse.touch && performance.now() > mouse.holdUntil) mouse.inside = false
    for (let i = 0; i < anchors.length; i++) {
      const node = nodes.current[i]
      if (!node) continue
      projected.copy(anchors[i].point).project(camera)
      const x = (projected.x + 1) * size.width / 2, y = (1 - projected.y) * size.height / 2
      const visible = projected.z >= -1 && projected.z <= 1 && x >= 0 && x <= size.width && y >= 28 && y <= size.height
      const labelX = Math.max(90, Math.min(size.width - 90, x))
      node.style.transform = `translate(${labelX}px, ${y - 16}px) translate(-50%, -100%)`
      node.style.setProperty('--city-offset', `${x - labelX}px`)
      if (!visible || !mouse.inside || mouse.dragging) continue
      if (mouse.touch && !mouse.tap) { if (selected.current === i) nearest = i; continue }
      // A small preference for the existing city avoids flicker between close
      // neighbours, without casting rays through the entire mountain mesh.
      const proximity = Math.hypot(x - mouse.x, y - mouse.y) - (selected.current === i ? 3 : 0)
      if (proximity < distance) { distance = proximity; nearest = i }
    }
    for (let i = 0; i < nodes.current.length; i++) nodes.current[i].classList.toggle('is-visible', i === nearest)
    selected.current = nearest
    mouse.tap = false
  })
  return null
}
