import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Vector3 } from 'three'
import { measuredTerrainPosition, railPoint, railSamples, type MeasuredTerrainBinding, type TerrainWindow } from './measured-terrain.ts'

const SCALE = 650
function Landscape({ binding, time, onReady }: { binding: MeasuredTerrainBinding; time: number; onReady: () => void }) {
  const { camera, size } = useThree(), grid = binding.data.terrain
  const frames = useRef(0)
  useFrame(() => { if (++frames.current === 3) onReady() })
  const geometry = useMemo(() => {
    const mesh = new BufferGeometry(), vertices: number[] = [], indices: number[] = [], colors: number[] = []
    for (let y=0;y<grid.rows;y++) for(let x=0;x<grid.columns;x++) {
      const height=grid.elevations[y*grid.columns+x]
      vertices.push((x/(grid.columns-1)-.5)*grid.widthMetres/SCALE, height/SCALE, (y/(grid.rows-1)-.5)*grid.depthMetres/SCALE)
      const snow=Math.max(0,Math.min(1,(height-2400)/1100))
      colors.push(.13+snow*.38,.21+snow*.36,.25+snow*.39)
      if(x<grid.columns-1 && y<grid.rows-1) { const i=y*grid.columns+x;indices.push(i,i+grid.columns,i+1,i+1,i+grid.columns,i+grid.columns+1) }
    }
    mesh.setAttribute('position',new Float32BufferAttribute(vertices,3));mesh.setAttribute('color',new Float32BufferAttribute(colors,3));mesh.setIndex(indices);mesh.computeVertexNormals()
    return mesh
  },[grid])
  const lines = useMemo(() => binding.routes.map(({route}) => {
    const distances=railSamples(route.points), vertices:number[]=[]
    for(let i=1;i<route.points.length;i++) {
      const start=distances[i-1]/distances.at(-1)!,end=distances[i]/distances.at(-1)!
      if(route.maskedRanges.some(r=>r.start<=end && r.end>=start))continue
      for(const p of [route.points[i-1],route.points[i]])vertices.push(p[0]/SCALE,p[2]/SCALE,p[1]/SCALE)
    }
    return { geometry:new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3)),distances }
  }),[binding.routes])
  useEffect(()=>()=>{geometry.dispose();for(const l of lines)l.geometry.dispose()},[geometry,lines])
  const position=measuredTerrainPosition(binding,time)!
  const points=position.route.points, distances=lines[position.legIndex].distances
  const p=railPoint(points,distances,position.progress), ahead=railPoint(points,distances,Math.min(1,position.progress+.004))
  const [px,pz,ph]=p
  const target=useMemo(()=>new Vector3(px/SCALE,ph/SCALE,pz/SCALE),[px,pz,ph])
  useLayoutEffect(()=>{
    // The viewing position clears the sampled landscape; railway height stays on the source axis.
    const x=target.x+1.8,z=target.z+2.3
    const gx=Math.max(0,Math.min(grid.columns-1,Math.round((x*SCALE/grid.widthMetres+.5)*(grid.columns-1))))
    const gy=Math.max(0,Math.min(grid.rows-1,Math.round((z*SCALE/grid.depthMetres+.5)*(grid.rows-1))))
    camera.position.set(x,Math.max(target.y+1.7,grid.elevations[gy*grid.columns+gx]/SCALE+1),z)
    if(camera instanceof PerspectiveCamera) {
      if(size.width <= 700) camera.setViewOffset(size.width,size.height,0,-size.height*.17,size.width,size.height)
      else camera.clearViewOffset()
    }
    camera.lookAt(target)
  },[camera,grid,size.width,size.height,target])
  return <>
    <color attach="background" args={['#080e20']} /><fog attach="fog" args={['#080e20',8,27]} />
    <ambientLight intensity={1.4}/><directionalLight position={[-8,18,8]} intensity={2.3} color="#e6e5d9"/>
    <mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={1} /></mesh>
    <mesh geometry={geometry}><meshBasicMaterial color="#9dc6d8" wireframe transparent opacity={.055} depthWrite={false} /></mesh>
    {lines.map((line,i)=><lineSegments key={i} geometry={line.geometry} renderOrder={2}><lineBasicMaterial color={['#ead395','#c3b4f4','#94dec9'][i]} depthTest={false} transparent opacity={i===position.legIndex?1:.45}/></lineSegments>)}
    <group position={target} rotation={[0,Math.atan2(ahead[0]-p[0],ahead[1]-p[1]),0]}>
      <mesh position={[0,.018,0]} renderOrder={3}><boxGeometry args={[.022,.025,.09]}/><meshBasicMaterial color="#fff3c7" depthTest={false}/></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} renderOrder={3}><ringGeometry args={[.06,.066,40]}/><meshBasicMaterial color="#ffda85" depthTest={false} transparent opacity={.65}/></mesh>
    </group>
  </>
}
export default function MeasuredTerrainScene({ binding, window: activeWindow, time, isPlaying, rate, onTime }: {
  binding: MeasuredTerrainBinding; window: TerrainWindow; time: number; isPlaying: boolean; rate: number; onTime: (time:number)=>void
}) {
  const [ready,setReady]=useState(false)
  const latest=useRef(onTime), clock=useRef(time), published=useRef(time)
  useLayoutEffect(()=>{latest.current=onTime;if(!isPlaying || time!==published.current)clock.current=time},[time,onTime,isPlaying])
  useEffect(()=>{
    if(!isPlaying)return
    let previous=performance.now(),report=previous,frame=0
    const tick=(now:number)=>{
      clock.current=Math.min(activeWindow.end,clock.current+Math.max(0,Math.min(.25,(now-previous)/1000))*rate);previous=now
      if(now-report>=50 || clock.current>=activeWindow.end){report=now;published.current=clock.current;latest.current(clock.current)}
      if(clock.current<activeWindow.end)frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
  },[isPlaying,rate,activeWindow])
  const position=measuredTerrainPosition(binding,time)
  if(!position)return null
  return <div className={`${binding.data.id.replace('-ascent','')}-scene`} data-rendered={ready} data-progress={position.progress} data-stopped={position.stopped} data-leg={position.legIndex} style={{width:'100%',height:'100%'}}>
    <Canvas dpr={[1,1.5]} camera={{fov:45,near:.01,far:80}}><Landscape binding={binding} time={time} onReady={() => setReady(true)}/></Canvas>
  </div>
}
