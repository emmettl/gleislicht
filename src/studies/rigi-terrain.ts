import type { UiLanguage } from '../i18n.ts'

export const RIGI_TERRAIN_COPY: Record<UiLanguage, { enter: string; ground: string; rise: string; profile: string; model: string }> = {
  en: { enter: 'Climb Vitznau → Rigi Kulm', ground: 'Ground elevation', rise: 'Rise from Vitznau', profile: 'Ground profile beneath the railway', model: 'Scenic playback · ground beneath mapped rail · stylised train · no track-height or tunnel survey' },
  de: { enter: 'Aufstieg Vitznau → Rigi Kulm', ground: 'Geländehöhe', rise: 'Anstieg ab Vitznau', profile: 'Geländeprofil unter der Bahntrasse', model: 'Szenische Wiedergabe · Gelände unter kartierter Trasse · stilisierter Zug · keine Gleishöhen- oder Tunnelvermessung' },
  fr: { enter: 'Monter de Vitznau → Rigi Kulm', ground: 'Altitude du terrain', rise: 'Montée depuis Vitznau', profile: 'Profil du terrain sous la voie', model: 'Animation panoramique · terrain sous le tracé cartographié · train stylisé · sans relevé des voies ni des tunnels' },
  it: { enter: 'Salita Vitznau → Rigi Kulm', ground: 'Quota del terreno', rise: 'Salita da Vitznau', profile: 'Profilo del terreno sotto la ferrovia', model: 'Animazione panoramica · terreno sotto il tracciato cartografato · treno stilizzato · nessun rilievo di binari o gallerie' },
}
