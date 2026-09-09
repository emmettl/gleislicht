// Display framing only: the published Ticino feed keeps its complete journey extent.
export const TICINO_FOCUS_BOUNDS = { minLongitude: 8.3821898, maxLongitude: 9.1596851, minLatitude: 45.8179597, maxLatitude: 46.6324789 } as const

export const TICINO_COPY = {
  en: {
    network: "Ticino · trains and valley buses",
    scope: "Partial canton coverage · initial rail and bus scope",
    subtitle: "Ticino and its valleys in motion",
    networkStatus: "Ticino network status",
    placeholder: "Search Lugano, Bellinzona or Locarno…",
    unavailable: "Ticino timetable unavailable",
    modes: "Selected trains and buses",
    view: "Ticino canton",
    model: "Scheduled journeys · inferred infrastructure and road paths",
    date: "Ticino timetable date",
  },
  de: {
    network: "Tessin · Bahn und Talbusse",
    scope: "Teilweise Kantonsabdeckung · erste Bahn- und Busauswahl",
    subtitle: "Tessin und seine Täler in Bewegung",
    networkStatus: "Tessiner Netzstatus",
    placeholder: "Lugano, Bellinzona oder Locarno suchen…",
    unavailable: "Tessiner Fahrplan nicht verfügbar",
    modes: "Ausgewählte Bahn- und Busfahrten",
    view: "Kanton Tessin",
    model: "Fahrplanfahrten · abgeleitete Bahn- und Strassenwege",
    date: "Tessiner Fahrplandatum",
  },
  fr: {
    network: "Tessin · trains et bus des vallées",
    scope: "Couverture partielle · première sélection de trains et bus",
    subtitle: "Le Tessin et ses vallées en mouvement",
    networkStatus: "État du réseau tessinois",
    placeholder: "Rechercher Lugano, Bellinzona ou Locarno…",
    unavailable: "Horaire tessinois indisponible",
    modes: "Sélection de trains et de bus",
    view: "Canton du Tessin",
    model: "Trajets horaires · parcours ferroviaires et routiers estimés",
    date: "Date de l’horaire tessinois",
  },
  it: {
    network: "Ticino · treni e autobus delle valli",
    scope: "Copertura parziale · prima selezione di treni e autobus",
    subtitle: "Il Ticino e le sue valli in movimento",
    networkStatus: "Stato della rete ticinese",
    placeholder: "Cerca Lugano, Bellinzona o Locarno…",
    unavailable: "Orario ticinese non disponibile",
    modes: "Treni e autobus selezionati",
    view: "Cantone Ticino",
    model: "Corse da orario · percorsi ferroviari e stradali stimati",
    date: "Data dell’orario ticinese",
  },
} as const


export const attribution = 'opentransportdata.swiss · © FOT · © OpenStreetMap contributors · ODbL'
