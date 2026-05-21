// Catalogus van standaard dossier-checklist items.
// Items zijn opzettelijk niet verplicht; ze sturen alleen welke rijen we tonen
// en welk gewicht ze hebben in de verkoopgereedheid-score.

export type DossierCategory = 'basis' | 'financieel' | 'juridisch' | 'technisch' | 'commercieel';

export const CATEGORY_LABELS: Record<DossierCategory, string> = {
  basis:       'Basisinformatie',
  financieel:  'Financiële informatie',
  juridisch:   'Huur & juridisch',
  technisch:   'Technisch & documentatie',
  commercieel: 'Commerciële voorbereiding',
};

export const CATEGORY_ORDER: DossierCategory[] = [
  'basis', 'financieel', 'juridisch', 'technisch', 'commercieel',
];

export type DossierStatus =
  | 'aanwezig'
  | 'opgevraagd'
  | 'ontbreekt'
  | 'niet_beschikbaar'
  | 'nvt'
  | 'te_controleren';

export const STATUS_LABELS: Record<DossierStatus, string> = {
  aanwezig:         'Aanwezig',
  opgevraagd:       'Opgevraagd',
  ontbreekt:        'Ontbreekt',
  niet_beschikbaar: 'Niet beschikbaar',
  nvt:              'Niet van toepassing',
  te_controleren:   'Te controleren',
};

export const STATUS_TONE: Record<DossierStatus, 'emerald' | 'amber' | 'crimson' | 'neutral' | 'sand' | 'gold'> = {
  aanwezig:         'emerald',
  opgevraagd:       'amber',
  ontbreekt:        'crimson',
  niet_beschikbaar: 'crimson',
  nvt:              'neutral',
  te_controleren:   'gold',
};

export interface CatalogItem {
  key: string;
  label: string;
  category: DossierCategory;
  /** 1 = normaal, 2 = belangrijk, 3 = cruciaal */
  weight: 1 | 2 | 3;
  /** Optioneel: als dit object-veld een waarde heeft, mag het item als 'aanwezig' worden afgeleid. */
  autoFromObjectField?: string;
}

export const CHECKLIST_CATALOG: CatalogItem[] = [
  // A. Basisinformatie
  { key: 'adres',                category: 'basis', label: 'Adres / locatie',        weight: 3, autoFromObjectField: 'adres' },
  { key: 'objecttype',           category: 'basis', label: 'Objecttype',              weight: 3, autoFromObjectField: 'typeVastgoed' },
  { key: 'subtype',              category: 'basis', label: 'Subtype',                 weight: 1, autoFromObjectField: 'subcategorie' },
  { key: 'bouwjaar',             category: 'basis', label: 'Bouwjaar',                weight: 2, autoFromObjectField: 'bouwjaar' },
  { key: 'oppervlakte',          category: 'basis', label: 'Oppervlakte',             weight: 3, autoFromObjectField: 'oppervlakte' },
  { key: 'perceel',              category: 'basis', label: 'Perceeloppervlakte',      weight: 1 },
  { key: 'eigendomssituatie',    category: 'basis', label: 'Eigendomssituatie',       weight: 2, autoFromObjectField: 'eigendomssituatie' },
  { key: 'erfpacht',             category: 'basis', label: 'Erfpachtinformatie',      weight: 2 },
  { key: 'kadastraal',           category: 'basis', label: 'Kadastrale gegevens',     weight: 1 },
  { key: 'bestemming',           category: 'basis', label: 'Bestemming',              weight: 2 },
  { key: 'energielabel',         category: 'basis', label: 'Energielabel',            weight: 2, autoFromObjectField: 'energielabel' },
  { key: 'woz',                  category: 'basis', label: 'WOZ-waarde',              weight: 1 },
  { key: 'onderhoudsstaat',      category: 'basis', label: 'Staat van onderhoud',     weight: 2 },
  { key: 'verhuurstaat',         category: 'basis', label: 'Verhuurde / leegstaande staat', weight: 2 },

  // B. Financiële informatie
  { key: 'vraagprijs',           category: 'financieel', label: 'Vraagprijs',            weight: 3, autoFromObjectField: 'vraagprijs' },
  { key: 'huurinkomsten',        category: 'financieel', label: 'Huurinkomsten',         weight: 3, autoFromObjectField: 'huurinkomsten' },
  { key: 'huurlijst',            category: 'financieel', label: 'Huurlijst',             weight: 3 },
  { key: 'servicekosten',        category: 'financieel', label: 'Servicekosten',         weight: 1 },
  { key: 'exploitatiekosten',    category: 'financieel', label: 'Exploitatiekosten',     weight: 2 },
  { key: 'bar',                  category: 'financieel', label: 'BAR',                   weight: 2 },
  { key: 'nar',                  category: 'financieel', label: 'NAR',                   weight: 1 },
  { key: 'factor',               category: 'financieel', label: 'Factor',                weight: 1 },
  { key: 'leegstand',            category: 'financieel', label: 'Leegstand',             weight: 2 },
  { key: 'kosten_koper',         category: 'financieel', label: 'Kosten koper / VON',    weight: 1 },
  { key: 'ovb_indicatie',        category: 'financieel', label: 'Overdrachtsbelasting indicatie', weight: 1 },
  { key: 'fee_afspraak',         category: 'financieel', label: 'Fee-afspraak',          weight: 2 },

  // C. Huur & juridisch
  { key: 'huurcontracten',       category: 'juridisch', label: 'Huurcontracten',         weight: 3 },
  { key: 'allonges',             category: 'juridisch', label: 'Allonges',               weight: 1 },
  { key: 'roz_model',            category: 'juridisch', label: 'ROZ-model',              weight: 1 },
  { key: 'huurtermijnen',        category: 'juridisch', label: 'Huurtermijnen',          weight: 2 },
  { key: 'opzegtermijnen',       category: 'juridisch', label: 'Opzegtermijnen',         weight: 1 },
  { key: 'waarborgsommen',       category: 'juridisch', label: 'Waarborgsommen',         weight: 1 },
  { key: 'indexaties',           category: 'juridisch', label: 'Indexaties',             weight: 1 },
  { key: 'huurachterstanden',    category: 'juridisch', label: 'Huurachterstanden',      weight: 2 },
  { key: 'vve_stukken',          category: 'juridisch', label: 'VvE-stukken',            weight: 1 },
  { key: 'splitsingsakte',       category: 'juridisch', label: 'Splitsingsakte',         weight: 2 },
  { key: 'vergunningen',         category: 'juridisch', label: 'Vergunningen',           weight: 1 },
  { key: 'bestemmingsplan',      category: 'juridisch', label: 'Bestemmingsplan / gebruik', weight: 2 },

  // D. Technisch & documentatie
  { key: 'fotos',                category: 'technisch', label: 'Foto\u2019s',           weight: 3 },
  { key: 'plattegronden',        category: 'technisch', label: 'Plattegronden',          weight: 2 },
  { key: 'meetrapport',          category: 'technisch', label: 'Meetrapport',            weight: 2 },
  { key: 'verkooptekeningen',    category: 'technisch', label: 'Verkooptekeningen',      weight: 1 },
  { key: 'bouwkundig',           category: 'technisch', label: 'Bouwkundige informatie', weight: 2 },
  { key: 'fundering',            category: 'technisch', label: 'Funderingsinformatie',   weight: 1 },
  { key: 'bodem_asbest',         category: 'technisch', label: 'Bodem / asbest',         weight: 1 },
  { key: 'installaties',         category: 'technisch', label: 'Installaties',           weight: 1 },
  { key: 'onderhoudsinfo',       category: 'technisch', label: 'Onderhoudsinformatie',   weight: 1 },
  { key: 'energierapportage',    category: 'technisch', label: 'Energierapportage',      weight: 1 },

  // E. Commerciële voorbereiding
  { key: 'teaser_klaar',         category: 'commercieel', label: 'Korte teaser klaar',         weight: 3 },
  { key: 'email_klaar',          category: 'commercieel', label: 'E-mailtekst klaar',          weight: 2 },
  { key: 'whatsapp_klaar',       category: 'commercieel', label: 'WhatsApp tekst klaar',       weight: 1 },
  { key: 'uitgebreide_klaar',    category: 'commercieel', label: 'Uitgebreide omschrijving klaar', weight: 2 },
  { key: 'highlights_klaar',     category: 'commercieel', label: 'Highlights klaar',           weight: 1 },
  { key: 'aandachtspunten_klaar',category: 'commercieel', label: 'Aandachtspunten geformuleerd', weight: 1 },
  { key: 'doelgroep',            category: 'commercieel', label: 'Doelgroep bepaald',          weight: 1 },
  { key: 'nda_nodig',            category: 'commercieel', label: 'NDA nodig (ja/nee)',         weight: 1 },
  { key: 'info_pakket',          category: 'commercieel', label: 'Informatie- / documentpakket klaar', weight: 2 },
  { key: 'im_klaar',             category: 'commercieel', label: 'IM / teaser klaar',          weight: 2 },
  { key: 'fee_tekst_klaar',      category: 'commercieel', label: 'Fee-tekst klaar',            weight: 1 },
];

/** Keys die geraakt worden door "Markeer als teaser-gereed". */
export const TEASER_READY_KEYS = ['teaser_klaar', 'doelgroep'];

/** Keys die geraakt worden door "Markeer als verkoopklaar". */
export const SALE_READY_KEYS = [
  'teaser_klaar', 'email_klaar', 'uitgebreide_klaar',
  'highlights_klaar', 'info_pakket', 'fee_tekst_klaar',
];
