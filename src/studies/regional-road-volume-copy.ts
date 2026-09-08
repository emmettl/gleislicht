import type { UiLanguage } from '../i18n.ts'
import type { VolumeHour } from './regional-road-volumes.ts'

export const REGIONAL_VOLUME_COPY = {
  en: {
    title: 'Hourly road counts', open: 'Explore hourly road counts', back: 'Back to recordings', intro: 'Basel-Stadt, Thurgau and Zürich city · 4 & 6 September 2026',
    note: 'Vehicles counted at individual locations. Missing hours stay empty; these counts do not measure speed or traffic between counters.',
    region: 'Region', date: 'Date', counter: 'Counter and source direction', regions: { basel: 'Basel-Stadt', thurgau: 'Thurgau', 'zurich-city': 'Zürich city' },
    loading: 'Loading hourly counts…', error: 'The counts could not be loaded or verified.', retry: 'Try again', empty: 'No counters available.',
    chart: 'Hourly vehicles · Swiss local time', hour: 'Hour', vehicles: 'vehicles', measuredHours: 'Measured hours', total: 'Complete day total', subtotal: 'Measured subtotal · incomplete day',
    classes: 'Sum of published vehicle classes', reported: 'Reported vehicle total', source: 'Source', quality: 'Quality', sourceValue: 'Source-reported value',
    inferred: 'Local direction inferred from source evidence', unresolved: 'Travel direction not reviewed', location: 'Road location needs review', excluded: 'Outside the through-road scope',
    absent: 'No source record', missing: 'Source reports a missing measurement', imputed: 'Imputed · excluded from chart', edited: 'Edited · excluded from chart', flagged: 'Flagged · excluded from chart', measured: 'Measured', unknown: 'Unreviewed quality',
    unapproved: 'Not approved by publisher', raw: 'Raw current-year data', approved: 'Approved by publisher', unspecified: 'Validation not specified', details: 'Hourly values and quality', noValue: 'No measured value',
  },
  de: {
    title: 'Stündliche Verkehrszählungen', open: 'Stündliche Verkehrszählungen ansehen', back: 'Zurück zu den Aufzeichnungen', intro: 'Basel-Stadt, Thurgau und Stadt Zürich · 4. & 6. September 2026',
    note: 'Gezählte Fahrzeuge an einzelnen Standorten. Fehlende Stunden bleiben leer; Geschwindigkeit und Verkehr zwischen Zählstellen werden nicht gemessen.',
    region: 'Region', date: 'Datum', counter: 'Zählstelle und Richtungsangabe', regions: { basel: 'Basel-Stadt', thurgau: 'Thurgau', 'zurich-city': 'Stadt Zürich' },
    loading: 'Stundenwerte werden geladen…', error: 'Die Zählungen konnten nicht geladen oder geprüft werden.', retry: 'Erneut versuchen', empty: 'Keine Zählstellen verfügbar.',
    chart: 'Fahrzeuge je Stunde · Schweizer Ortszeit', hour: 'Stunde', vehicles: 'Fahrzeuge', measuredHours: 'Gemessene Stunden', total: 'Vollständige Tagessumme', subtotal: 'Gemessene Teilsumme · Tag unvollständig',
    classes: 'Summe der veröffentlichten Fahrzeugklassen', reported: 'Gemeldete Fahrzeugzahl', source: 'Quelle', quality: 'Qualität', sourceValue: 'Wert der Quelle',
    inferred: 'Lokale Fahrtrichtung aus Quellen abgeleitet', unresolved: 'Fahrtrichtung nicht geprüft', location: 'Strassenlage muss geprüft werden', excluded: 'Ausserhalb des Durchgangsstrassennetzes',
    absent: 'Kein Quelldatensatz', missing: 'Quelle meldet fehlende Messung', imputed: 'Imputiert · im Diagramm ausgelassen', edited: 'Bearbeitet · im Diagramm ausgelassen', flagged: 'Auffällig · im Diagramm ausgelassen', measured: 'Gemessen', unknown: 'Qualität ungeprüft',
    unapproved: 'Vom Herausgeber nicht freigegeben', raw: 'Rohdaten des laufenden Jahres', approved: 'Vom Herausgeber freigegeben', unspecified: 'Validierung nicht angegeben', details: 'Stundenwerte und Qualität', noValue: 'Kein Messwert',
  },
  fr: {
    title: 'Comptages routiers horaires', open: 'Explorer les comptages horaires', back: 'Retour aux enregistrements', intro: 'Bâle-Ville, Thurgovie et ville de Zurich · 4 et 6 septembre 2026',
    note: 'Véhicules comptés à chaque emplacement. Les heures manquantes restent vides ; ces comptages ne mesurent ni la vitesse ni le trafic entre compteurs.',
    region: 'Région', date: 'Date', counter: 'Compteur et direction indiquée', regions: { basel: 'Bâle-Ville', thurgau: 'Thurgovie', 'zurich-city': 'Ville de Zurich' },
    loading: 'Chargement des comptages…', error: 'Impossible de charger ou de vérifier les comptages.', retry: 'Réessayer', empty: 'Aucun compteur disponible.',
    chart: 'Véhicules par heure · heure suisse', hour: 'Heure', vehicles: 'véhicules', measuredHours: 'Heures mesurées', total: 'Total de la journée complète', subtotal: 'Sous-total mesuré · journée incomplète',
    classes: 'Somme des classes de véhicules publiées', reported: 'Total de véhicules déclaré', source: 'Source', quality: 'Qualité', sourceValue: 'Valeur déclarée par la source',
    inferred: 'Direction locale déduite des sources', unresolved: 'Sens de circulation non vérifié', location: 'Localisation routière à vérifier', excluded: 'Hors du réseau routier de transit',
    absent: 'Aucun enregistrement source', missing: 'Mesure signalée manquante', imputed: 'Imputée · exclue du graphique', edited: 'Modifiée · exclue du graphique', flagged: 'Signalée · exclue du graphique', measured: 'Mesurée', unknown: 'Qualité non vérifiée',
    unapproved: 'Non approuvée par le producteur', raw: 'Données brutes de l’année en cours', approved: 'Approuvée par le producteur', unspecified: 'Validation non précisée', details: 'Valeurs horaires et qualité', noValue: 'Aucune valeur mesurée',
  },
  it: {
    title: 'Conteggi stradali orari', open: 'Esplora i conteggi orari', back: 'Torna alle registrazioni', intro: 'Basilea Città, Turgovia e città di Zurigo · 4 e 6 settembre 2026',
    note: 'Veicoli contati nei singoli punti. Le ore mancanti restano vuote; i conteggi non misurano la velocità o il traffico tra i contatori.',
    region: 'Regione', date: 'Data', counter: 'Contatore e direzione indicata', regions: { basel: 'Basilea Città', thurgau: 'Turgovia', 'zurich-city': 'Città di Zurigo' },
    loading: 'Caricamento dei conteggi…', error: 'Impossibile caricare o verificare i conteggi.', retry: 'Riprova', empty: 'Nessun contatore disponibile.',
    chart: 'Veicoli all’ora · ora svizzera', hour: 'Ora', vehicles: 'veicoli', measuredHours: 'Ore misurate', total: 'Totale della giornata completa', subtotal: 'Subtotale misurato · giornata incompleta',
    classes: 'Somma delle classi di veicoli pubblicate', reported: 'Totale veicoli dichiarato', source: 'Fonte', quality: 'Qualità', sourceValue: 'Valore dichiarato dalla fonte',
    inferred: 'Direzione locale dedotta dalle fonti', unresolved: 'Direzione di marcia non verificata', location: 'Posizione stradale da verificare', excluded: 'Fuori dalla rete stradale di transito',
    absent: 'Nessun record nella fonte', missing: 'Misurazione segnalata mancante', imputed: 'Imputata · esclusa dal grafico', edited: 'Modificata · esclusa dal grafico', flagged: 'Segnalata · esclusa dal grafico', measured: 'Misurata', unknown: 'Qualità non verificata',
    unapproved: 'Non approvata dal fornitore', raw: 'Dati grezzi dell’anno corrente', approved: 'Approvata dal fornitore', unspecified: 'Validazione non specificata', details: 'Valori orari e qualità', noValue: 'Nessun valore misurato',
  },
}

export function volumeQuality(hour: VolumeHour, copy: typeof REGIONAL_VOLUME_COPY[UiLanguage]): string {
  if (hour.issues.length) return copy.flagged
  return ({ measured: copy.measured, missing: copy.missing, absent: copy.absent, imputed: copy.imputed, edited: copy.edited } as Record<string, string>)[hour.quality.status] ?? copy.unknown
}
