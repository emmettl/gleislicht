import { useEffect, useMemo, useRef, useState } from 'react'
import { formatServiceTime, type NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { UiLanguage } from '../i18n.ts'
import { gornergratAscents } from './gornergrat.ts'
import { GORNERGRAT_COPY } from './gornergrat-copy.ts'
import './gornergrat.css'
export default function GornergratAscent({network,language,time,onSeek,onFollow,onFinish,onExit}:{network:NetworkSnapshot;language:UiLanguage;time:number;onSeek:(t:number)=>void;onFollow:(id:string|undefined,station:string|undefined)=>void;onFinish:()=>void;onExit:()=>void}){
 const stops=useRef<HTMLElement>(null)
 const copy=GORNERGRAT_COPY[language],choices=useMemo(()=>gornergratAscents(network),[network]),[id,setId]=useState<string>()
 const train=choices.find(t=>t.id===id)??choices.reduce((best,t)=>Math.abs(t.stops[0][2]-43200)<Math.abs(best.stops[0][2]-43200)?t:best,choices[0])
 const start=train?.stops[0][2],end=train?.stops.at(-1)![1],phase=start===undefined?'unavailable':time<start?'before':time>=end!?'complete':'rail'
 useEffect(()=>{if(start!==undefined)onSeek(start)},[start,onSeek])
 useEffect(()=>{onFollow(phase==='rail'?train?.id:undefined,phase==='complete'?'Gornergrat':phase==='before'?'Zermatt GGB':undefined);if(phase==='complete')onFinish()},[phase,train,onFollow,onFinish])
 const active=train?.stops.findIndex(([,a,d],i)=>time>=a && (time<=d || time<(train.stops[i+1]?.[1]??d)))
 useEffect(()=>{const current=stops.current?.querySelector<HTMLElement>('[aria-current="step"]');if(current && stops.current)stops.current.scrollLeft=current.offsetLeft-stops.current.offsetLeft-(stops.current.clientWidth-current.clientWidth)/2},[active])
 return <section className="journey-card gornergrat-ascent" aria-label={copy.title} data-phase={phase}>
  <header><h2>{copy.title}</h2><button onClick={onExit} aria-label={copy.exit}>×</button></header>
  {!train?<p role="status">{copy.empty}</p>:<>
   <label>{copy.departure}<select value={train.id} onChange={e=>setId(e.target.value)}>{choices.map(t=><option value={t.id} key={t.id}>{formatServiceTime(t.stops[0][2])} → {formatServiceTime(t.stops.at(-1)![1])}</option>)}</select></label>
   <p>{network.metadata.serviceDate} · Gornergratbahn · {train.shortName}</p>
   <nav ref={stops} aria-label={copy.guide}>{train.stops.map(([index,a,d],i)=><button key={index} aria-current={active===i?'step':undefined} onClick={()=>onSeek(i===0?d:a)}><strong>{network.stops[index][2]}</strong><span>{formatServiceTime(a)}{d!==a?` → ${formatServiceTime(d)}`:''}</span></button>)}</nav>
   <p role="status">{phase==='complete'?copy.complete:phase==='before'?copy.before:copy.model}</p>
   <details><summary>{copy.evidence}</summary><p>{copy.note}</p><a href="./methodology.html#gornergrat" target="_blank" rel="noreferrer">{copy.evidence} ↗</a> · <a href="https://www.gornergrat.ch/en/pages/timetable-gornergrat-bahn" target="_blank" rel="noreferrer">Gornergratbahn ↗</a></details>
   {phase==='complete'&&<button className="corridor-entry" onClick={()=>onSeek(start!)}>{copy.replay} ↻</button>}
  </>}
 </section>
}
