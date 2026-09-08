import {useEffect,useMemo,useRef,useState} from 'react'
import {formatServiceTime,type NetworkSnapshot} from '@motionstudies/core/domain/network'
import type {UiLanguage} from '../i18n.ts'
import {rochersJourneys,type RochersDirection} from './rochers.ts'
import {ROCHERS_COPY} from './rochers-copy.ts'
export default function RochersJourney({network,language,time,onSeek,onFollow,onFinish,onExit}:{network:NetworkSnapshot;language:UiLanguage;time:number;onSeek:(time:number)=>void;onFollow:(id:string|undefined,station:string|undefined)=>void;onFinish:()=>void;onExit:()=>void}){
 const copy=ROCHERS_COPY[language],stops=useRef<HTMLElement>(null),[direction,setDirection]=useState<RochersDirection>('ascent'),[id,setId]=useState<string>(),[expanded,setExpanded]=useState(false)
 const choices=useMemo(()=>rochersJourneys(network,direction),[network,direction])
 const train=choices.find(t=>t.id===id)??choices.reduce((a,b)=>Math.abs(b.start-43200)<Math.abs(a.start-43200)?b:a,choices[0])
 const start=train?.stops[0][2],end=train?.stops.at(-1)![1],phase=start===undefined?'unavailable':time<start?'before':time>=end!?'complete':'rail'
 const from=train&&network.stops[train.stops[0][0]][2],to=train&&network.stops[train.stops.at(-1)![0]][2]
 useEffect(()=>{if(start!==undefined)onSeek(start)},[start,train?.id,onSeek])
 useEffect(()=>{onFollow(phase==='rail'?train?.id:undefined,phase==='before'?from:phase==='complete'?to:undefined);if(phase==='complete')onFinish()},[phase,train,from,to,onFollow,onFinish])
 const active=train?.stops.findIndex(([,a,d],i)=>time>=a&&(time<=d||time<(train.stops[i+1]?.[1]??d)))
 useEffect(()=>{const current=stops.current?.querySelector<HTMLElement>('[aria-current="step"]');if(current&&stops.current)stops.current.scrollLeft=current.offsetLeft-stops.current.offsetLeft-(stops.current.clientWidth-current.clientWidth)/2},[active])
 return <section className="journey-card rochers-journey" aria-label={copy[direction]} data-phase={phase} data-direction={direction} data-expanded={expanded}>
  <header><h2>{copy[direction]}</h2><button className="rochers-details-toggle" aria-label={copy.details} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>≡</button><button onClick={onExit} aria-label={copy.exit}>×</button></header>
  <label>{copy.direction}<select value={direction} onChange={e=>{setDirection(e.target.value as RochersDirection);setId(undefined)}}><option value="ascent">{copy.ascent}</option><option value="descent">{copy.descent}</option></select></label>
  {!train?<p role="status">{copy.empty}</p>:<>
   <label>{copy.departure}<select value={train.id} onChange={e=>setId(e.target.value)}>{choices.map(t=><option key={t.id} value={t.id}>{formatServiceTime(t.stops[0][2])} → {formatServiceTime(t.stops.at(-1)![1])}</option>)}</select></label>
   <p>{network.metadata.serviceDate} · MVR · {train.shortName}</p>
   <nav ref={stops} aria-label={copy.guide}>{train.stops.map(([index,a,d],i)=><button key={index} aria-current={active===i?'step':undefined} onClick={()=>{onSeek(i===0?d:a);setExpanded(false)}}><strong>{network.stops[index][2]}</strong><span>{formatServiceTime(a)}{a!==d?` → ${formatServiceTime(d)}`:''}</span></button>)}</nav>
   <p role="status">{phase==='complete'?`${copy.arrived} · ${to}`:phase==='before'?copy.before:copy.model}</p>
   <p>{copy.serviceNote}</p>
   <details><summary>{copy.evidence}</summary><p>{copy.note}</p><a href="./methodology.html#rochers" target="_blank" rel="noreferrer">{copy.evidence} ↗</a> · <a href="https://www.mob.ch/en/stories/rochers-de-naye" target="_blank" rel="noreferrer">MVR ↗</a></details>
   {phase==='complete'&&<button className="corridor-entry" onClick={()=>onSeek(start!)}>{copy.replay} ↻</button>}
  </>}
 </section>
}
