import type { UiLanguage } from '../i18n.ts'
import { GORNERGRAT_COPY } from './gornergrat-copy.ts'
import type { GornergratDirection } from './gornergrat.ts'
const en={direction:'Direction',ascent:'Zermatt → Gornergrat',descent:'Gornergrat → Zermatt',exit:'Exit descent',replay:'Replay descent',complete:'Arrived at Zermatt GGB',empty:'No audited complete descent is available.',guide:'Stops on this descent',terrainError:'Terrain unavailable. The descent remains on the map.'}
const COPY:Record<UiLanguage,typeof en>={en,
 de:{direction:'Richtung',ascent:'Zermatt → Gornergrat',descent:'Gornergrat → Zermatt',exit:'Abfahrt verlassen',replay:'Abfahrt wiederholen',complete:'In Zermatt GGB angekommen',empty:'Keine geprüfte vollständige Abfahrt verfügbar.',guide:'Halte dieser Abfahrt',terrainError:'Gelände nicht verfügbar. Die Abfahrt bleibt auf der Karte.'},
 fr:{direction:'Sens du trajet',ascent:'Zermatt → Gornergrat',descent:'Gornergrat → Zermatt',exit:'Quitter la descente',replay:'Rejouer la descente',complete:'Arrivée à Zermatt GGB',empty:'Aucune descente complète vérifiée disponible.',guide:'Arrêts de cette descente',terrainError:'Relief indisponible. La descente reste sur la carte.'},
 it:{direction:'Direzione',ascent:'Zermatt → Gornergrat',descent:'Gornergrat → Zermatt',exit:'Esci dalla discesa',replay:'Ripeti la discesa',complete:'Arrivo a Zermatt GGB',empty:'Nessuna discesa completa verificata disponibile.',guide:'Fermate di questa discesa',terrainError:'Terreno non disponibile. La discesa resta sulla mappa.'},
}
export function gornergratJourneyCopy(language:UiLanguage,direction:GornergratDirection){
 const shared=GORNERGRAT_COPY[language],journey=COPY[language]
 return {...shared,...(direction==='descent'?{title:journey.descent,exit:journey.exit,replay:journey.replay,complete:journey.complete,empty:journey.empty,guide:journey.guide}:{}),direction:journey.direction,ascent:journey.ascent,descent:journey.descent,terrainError:journey.terrainError}
}
