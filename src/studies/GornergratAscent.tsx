import { useEffect, useMemo, useRef, useState } from 'react'
import { formatServiceTime, type NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { gornergratJourneys, type GornergratDirection } from './gornergrat.ts'
import { gornergratJourneyCopy } from './gornergrat-journey-copy.ts'
import { bindGornergratTerrain } from './gornergrat-terrain.ts'
import { measuredTerrainPosition, railPoint, railSamples, type MeasuredTerrainBinding } from './measured-terrain.ts'
import { measuredTerrainCopy } from './measured-terrain-copy.ts'
import './gornergrat.css'
export default function GornergratAscent({network,language,time,onSeek,onFollow,onFinish,onExit,onTerrain}:{network:NetworkSnapshot;language:UiLanguage;time:number;onSeek:(t:number)=>void;onFollow:(id:string|undefined,station:string|undefined)=>void;onFinish:()=>void;onExit:()=>void;onTerrain:(binding:MeasuredTerrainBinding|undefined)=>void}){
 const stops=useRef<HTMLElement>(null)
 const [direction,setDirection]=useState<GornergratDirection>('ascent')
 const copy=gornergratJourneyCopy(language,direction),choices=useMemo(()=>gornergratJourneys(network,direction),[network,direction]),[id,setId]=useState<string>()
 const train=choices.find(t=>t.id===id)??choices.reduce((best,t)=>Math.abs(t.stops[0][2]-43200)<Math.abs(best.stops[0][2]-43200)?t:best,choices[0])
 const terrainCopy={...measuredTerrainCopy(language,44),...(direction==='descent'?{error:copy.terrainError}:{})}
 const [itineraryOpen,setItineraryOpen]=useState(false)
 const [terrainWanted,setTerrainWanted]=useState(false),[terrainData,setTerrainData]=useState<{value:unknown}>(),[terrainError,setTerrainError]=useState(false),[attempt,setAttempt]=useState(0)
 useEffect(()=>{
  if(!terrainWanted || terrainData)return
  const controller=new AbortController()
  fetch(`${import.meta.env.BASE_URL}data/gornergrat-ascent-terrain.json`,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('Terrain unavailable');return response.json()}).then(value=>setTerrainData({value})).catch(error=>{if(error.name!=='AbortError')setTerrainError(true)})
  return()=>controller.abort()
 },[terrainWanted,terrainData,attempt])
 const terrain=useMemo(()=>train && terrainData?bindGornergratTerrain(terrainData.value,network,train):undefined,[terrainData,network,train])
 useEffect(()=>{onTerrain(terrainWanted?terrain:undefined);return()=>onTerrain(undefined)},[terrain,terrainWanted,onTerrain])
 const terrainPosition=terrainWanted && terrain?measuredTerrainPosition(terrain,time):undefined
 const terrainVisible=terrainWanted && terrain?.windows.some(w=>time>=w.start && time<w.end)
 const railHeight=terrainPosition?Math.round(railPoint(terrainPosition.route.points,railSamples(terrainPosition.route.points),terrainPosition.progress)[2]):undefined
 const failed=terrainError || Boolean(terrainData && !terrain)
 const start=train?.stops[0][2],end=train?.stops.at(-1)![1],phase=start===undefined?'unavailable':time<start?'before':time>=end!?'complete':'rail'
 useEffect(()=>{if(start!==undefined)onSeek(start)},[start,train?.id,onSeek])
 useEffect(()=>{onFollow(phase==='rail'?train?.id:undefined,phase==='complete'&&train?network.stops[train.stops.at(-1)![0]][2]:phase==='before'&&train?network.stops[train.stops[0][0]][2]:undefined);if(phase==='complete')onFinish()},[phase,train,network,onFollow,onFinish])
 const active=train?.stops.findIndex(([,a,d],i)=>time>=a && (time<=d || time<(train.stops[i+1]?.[1]??d)))
 useEffect(()=>{const current=stops.current?.querySelector<HTMLElement>('[aria-current="step"]');if(current && stops.current)stops.current.scrollLeft=current.offsetLeft-stops.current.offsetLeft-(stops.current.clientWidth-current.clientWidth)/2},[active])
 return <section className="journey-card gornergrat-ascent" aria-label={copy.title} data-phase={phase} data-direction={direction} data-compact={terrainWanted && !itineraryOpen}>
  <header><h2>{copy.title}</h2>{terrainWanted && <button type="button" aria-label={terrainCopy.details} aria-expanded={itineraryOpen} onClick={()=>setItineraryOpen(v=>!v)}>≡</button>}<button onClick={onExit} aria-label={copy.exit}>×</button></header>
  <label>{copy.direction}<select value={direction} onChange={event=>{setDirection(event.target.value as GornergratDirection);setId(undefined)}}><option value="ascent">{copy.ascent}</option><option value="descent">{copy.descent}</option></select></label>
  {!train?<p role="status">{copy.empty}</p>:<>
   <label>{copy.departure}<select value={train.id} onChange={e=>setId(e.target.value)}>{choices.map(t=><option value={t.id} key={t.id}>{formatServiceTime(t.stops[0][2])} → {formatServiceTime(t.stops.at(-1)![1])}</option>)}</select></label>
   <p>{network.metadata.serviceDate} · Gornergratbahn · {train.shortName}</p>
   <nav ref={stops} aria-label={copy.guide}>{train.stops.map(([index,a,d],i)=><button key={index} aria-current={active===i?'step':undefined} onClick={()=>onSeek(i===0?d:a)}><strong>{network.stops[index][2]}</strong><span>{formatServiceTime(a)}{d!==a?` → ${formatServiceTime(d)}`:''}</span></button>)}</nav>
   <p role="status">{phase==='complete'?copy.complete:phase==='before'?copy.before:terrainVisible?terrainCopy.outdoor:copy.model}</p>
      <div className="gornergrat-terrain-control">
        <button className="gornergrat-terrain-button" type="button" aria-pressed={terrainWanted} onClick={() => { setTerrainError(false); setTerrainWanted(value => !value) }}>{terrainWanted ? terrainCopy.hide : terrainCopy.show}</button>
        {terrainPosition && <p className="terrain-leg-label">{terrainPosition.from}{terrainPosition.from !== terrainPosition.to ? ` → ${terrainPosition.to}` : ''}</p>}
        {terrainWanted && <p role="status" data-terrain-status={failed ? 'error' : !terrain ? 'loading' : terrainVisible ? 'outdoor' : terrainPosition?.mask?.reason ?? 'wait'}>{failed ? terrainCopy.error : !terrain ? terrainCopy.loading : phase==='complete' ? copy.complete : phase==='before' ? copy.before : terrainVisible ? terrainCopy.outdoor : terrainCopy[terrainPosition?.mask?.reason ?? 'wait']}</p>}
        {terrainWanted && failed && <button className="gornergrat-terrain-button" onClick={() => { setTerrainError(false); setTerrainData(undefined); setAttempt(n => n+1) }}>{terrainCopy.retry}</button>}
        {terrainWanted && terrain && <details><summary>{terrainCopy.sources}{railHeight !== undefined ? ` · ${railHeight.toLocaleString(language)} m` : ''}</summary><p>{terrainCopy.model}</p>{railHeight !== undefined && <p>{terrainCopy.elevation}: {railHeight.toLocaleString(language)} m (LN02)</p>}<p>© swisstopo · swissALTIRegio {terrain.data.metadata.terrainRelease} · swissTLM3D 2026-02</p><a href="./methodology.html#gornergrat-terrain" target="_blank" rel="noreferrer">{terrainCopy.sources} ↗</a></details>}
      </div>
   <details><summary>{copy.evidence}</summary><p>{copy.note}</p><a href="./methodology.html#gornergrat" target="_blank" rel="noreferrer">{copy.evidence} ↗</a> · <a href="https://www.gornergrat.ch/en/pages/timetable-gornergrat-bahn" target="_blank" rel="noreferrer">Gornergratbahn ↗</a></details>
   {phase==='complete'&&<button className="corridor-entry" onClick={()=>onSeek(start!)}>{copy.replay} ↻</button>}
  </>}
 </section>
}
