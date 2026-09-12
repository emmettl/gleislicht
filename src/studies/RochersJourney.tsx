import { editionDataUrl } from '../editions/data-url.ts'
import {useEffect,useMemo,useRef,useState} from 'react'
import {formatServiceTime,type NetworkSnapshot} from '@motionstudies/core/domain/network'
import type {UiLanguage} from '../i18n.ts'
import {rochersJourneys,type RochersDirection} from './rochers.ts'
import { bindRochersTerrain } from './rochers-terrain.ts'
import { measuredTerrainPosition, railPoint, railSamples, type MeasuredTerrainBinding } from './measured-terrain.ts'
import { measuredTerrainCopy } from './measured-terrain-copy.ts'
import {ROCHERS_COPY} from './rochers-copy.ts'
export default function RochersJourney({network,language,time,onSeek,onFollow,onFinish,onExit,onTerrain}:{network:NetworkSnapshot;language:UiLanguage;time:number;onSeek:(time:number)=>void;onFollow:(id:string|undefined,station:string|undefined)=>void;onFinish:()=>void;onExit:()=>void;onTerrain:(binding:MeasuredTerrainBinding|undefined)=>void}){
 const copy=ROCHERS_COPY[language],stops=useRef<HTMLElement>(null),[direction,setDirection]=useState<RochersDirection>('ascent'),[id,setId]=useState<string>(),[expanded,setExpanded]=useState(false)
 const choices=useMemo(()=>rochersJourneys(network,direction),[network,direction])
 const train=choices.find(t=>t.id===id)??choices.reduce((a,b)=>Math.abs(b.start-43200)<Math.abs(a.start-43200)?b:a,choices[0])
 const terrainCopy={...measuredTerrainCopy(language,42),error:copy.terrainError}
 const [terrainWanted,setTerrainWanted]=useState(false),[terrainData,setTerrainData]=useState<{value:unknown}>(),[terrainError,setTerrainError]=useState(false),[attempt,setAttempt]=useState(0)
 useEffect(()=>{
  if(!terrainWanted || terrainData)return
  const controller=new AbortController()
  fetch(editionDataUrl('rochers-ascent-terrain.json'),{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('Terrain unavailable');return response.json()}).then(value=>setTerrainData({value})).catch(error=>{if(error.name!=='AbortError')setTerrainError(true)})
  return()=>controller.abort()
 },[terrainWanted,terrainData,attempt])
 const terrain=useMemo(()=>train && terrainData?bindRochersTerrain(terrainData.value,network,train):undefined,[terrainData,network,train])
 useEffect(()=>{onTerrain(terrainWanted?terrain:undefined);return()=>onTerrain(undefined)},[terrain,terrainWanted,onTerrain])
 const terrainPosition=terrainWanted && terrain?measuredTerrainPosition(terrain,time):undefined
 const terrainVisible=terrainWanted && terrain?.windows.some(w=>time>=w.start && time<w.end)
 const railHeight=terrainPosition?Math.round(railPoint(terrainPosition.route.points,railSamples(terrainPosition.route.points),terrainPosition.progress)[2]):undefined
 const failed=terrainError || Boolean(terrainData && !terrain)
 const start=train?.stops[0][2],end=train?.stops.at(-1)![1],phase=start===undefined?'unavailable':time<start?'before':time>=end!?'complete':'rail'
 const from=train&&network.stops[train.stops[0][0]][2],to=train&&network.stops[train.stops.at(-1)![0]][2]
 useEffect(()=>{if(start!==undefined)onSeek(start)},[start,train?.id,onSeek])
 useEffect(()=>{onFollow(phase==='rail'?train?.id:undefined,phase==='before'?from:phase==='complete'?to:undefined);if(phase==='complete')onFinish()},[phase,train,from,to,onFollow,onFinish])
 const active=train?.stops.findIndex(([,a,d],i)=>time>=a&&(time<=d||time<(train.stops[i+1]?.[1]??d)))
 useEffect(()=>{const current=stops.current?.querySelector<HTMLElement>('[aria-current="step"]');if(current&&stops.current)stops.current.scrollLeft=current.offsetLeft-stops.current.offsetLeft-(stops.current.clientWidth-current.clientWidth)/2},[active])
 return <section className="journey-card rochers-journey" aria-label={copy[direction]} data-phase={phase} data-direction={direction} data-expanded={expanded} data-compact={terrainWanted && !expanded} data-terrain-wanted={terrainWanted}>
  <header><h2>{copy[direction]}</h2><button className="rochers-details-toggle" aria-label={copy.details} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>≡</button><button onClick={onExit} aria-label={copy.exit}>×</button></header>
  <label>{copy.direction}<select value={direction} onChange={e=>{setDirection(e.target.value as RochersDirection);setId(undefined)}}><option value="ascent">{copy.ascent}</option><option value="descent">{copy.descent}</option></select></label>
  {!train?<p role="status">{copy.empty}</p>:<>
   <label>{copy.departure}<select value={train.id} onChange={e=>setId(e.target.value)}>{choices.map(t=><option key={t.id} value={t.id}>{formatServiceTime(t.stops[0][2])} → {formatServiceTime(t.stops.at(-1)![1])}</option>)}</select></label>
   <p>{network.metadata.serviceDate} · MVR · {train.shortName}</p>
   <nav ref={stops} aria-label={copy.guide}>{train.stops.map(([index,a,d],i)=><button key={index} aria-current={active===i?'step':undefined} onClick={()=>{onSeek(i===0?d:a);setExpanded(false)}}><strong>{network.stops[index][2]}</strong><span>{formatServiceTime(a)}{a!==d?` → ${formatServiceTime(d)}`:''}</span></button>)}</nav>
   <p role="status">{phase==='complete'?`${copy.arrived} · ${to}`:phase==='before'?copy.before:terrainVisible?terrainCopy.outdoor:copy.model}</p>
      <div className="rochers-terrain-control">
        <button className="rochers-terrain-button" type="button" aria-pressed={terrainWanted} onClick={() => { setTerrainError(false); setTerrainWanted(value => !value) }}>{terrainWanted ? terrainCopy.hide : terrainCopy.show}</button>
        {terrainPosition && <p className="terrain-leg-label">{terrainPosition.from}{terrainPosition.from !== terrainPosition.to ? ` → ${terrainPosition.to}` : ''}</p>}
        {terrainWanted && <p role="status" data-terrain-status={failed ? 'error' : !terrain ? 'loading' : terrainVisible ? 'outdoor' : terrainPosition?.mask?.reason ?? 'wait'}>{failed ? terrainCopy.error : !terrain ? terrainCopy.loading : phase==='complete' ? `${copy.arrived} · ${to}` : phase==='before' ? copy.before : terrainVisible ? terrainCopy.outdoor : terrainCopy[terrainPosition?.mask?.reason ?? 'wait']}</p>}
        {terrainWanted && failed && <button className="rochers-terrain-button" onClick={() => { setTerrainError(false); setTerrainData(undefined); setAttempt(n => n+1) }}>{terrainCopy.retry}</button>}
        {terrainWanted && terrain && <details><summary>{terrainCopy.sources}{railHeight !== undefined ? ` · ${railHeight.toLocaleString(language)} m` : ''}</summary><p>{terrainCopy.model}</p>{railHeight !== undefined && <p>{terrainCopy.elevation}: {railHeight.toLocaleString(language)} m (LN02)</p>}<p>© swisstopo · swissALTIRegio {terrain.data.metadata.terrainRelease} · swissTLM3D 2026-02</p><a href="./methodology.html#rochers-terrain" target="_blank" rel="noreferrer">{terrainCopy.sources} ↗</a></details>}
      </div>
   <p>{copy.serviceNote}</p>
   <details><summary>{copy.evidence}</summary><p>{copy.note}</p><a href="./methodology.html#rochers" target="_blank" rel="noreferrer">{copy.evidence} ↗</a> · <a href="https://www.mob.ch/en/stories/rochers-de-naye" target="_blank" rel="noreferrer">MVR ↗</a></details>
   {phase==='complete'&&<button className="corridor-entry" onClick={()=>onSeek(start!)}>{copy.replay} ↻</button>}
  </>}
 </section>
}
