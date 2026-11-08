/** Alle bevestigde Contact Form 7-velden van bitovastgoed.nl.
 * Matchinggegevens zijn te bewerken op Relaties. Privacy, nieuwsbrief en
 * herkomst zijn alleen brongegevens van een specifieke inzending.
 */
export const WEBSITE_INVESTEERDERSVELDEN: Record<string,string> = {
  'your-name':'Naam',
  company:'Bedrijf / organisatie',
  'your-email':'E-mailadres',
  telephone:'Telefoon',
  'party-type':'Type partij',
  'asset-types':'Vastgoedsegmenten',
  strategy:'Investeringsstrategie',
  'investment-size':'Budget per transactie',
  'search-area':'Zoekgebied',
  'object-size':'Gewenste objectomvang',
  situation:'Gewenste verhuur- en objectsituatie',
  'return-target':'Rendementsdoel / BAR',
  'purchase-term':'Aankooptermijn',
  financing:'Financieringsstructuur',
  'financing-status':'Status financiering',
  'decision-speed':'Besluitvorming',
  'hard-criteria':'Belangrijkste acquisitiecriteria',
  dealbreakers:'Uitsluitingen',
  notes:'Overige toelichting',
  privacy:'Privacyverklaring — formulier',
  mc4wp_checkbox:'Nieuwsbriefkeuze — formulier',
  bito_herkomst_bron:'Herkomst — bron',
  bito_herkomst_medium:'Herkomst — medium',
  bito_herkomst_campagne:'Herkomst — campagne',
  bito_herkomst_verwijzer:'Herkomst — verwijzer',
  bito_herkomst_toestemming:'Toestemming voor websitestatistieken',
  bito_herkomst_landingspagina:'Landingspagina',
  bito_herkomst_formulierpagina:'Formulierpagina',
};

export function websiteVeldLabel(veld: string): string {
  return WEBSITE_INVESTEERDERSVELDEN[veld] ?? veld;
}

export function websiteVeldWaarde(waarde: string | string[] | null | undefined): string {
  if (Array.isArray(waarde)) return waarde.length ? waarde.join(', ') : 'Niet ingevuld';
  return (waarde ?? '').trim() || 'Niet ingevuld';
}

export function isWebsiteBronmetadata(veld: string): boolean {
  return veld.startsWith('bito_herkomst_') ||
    veld==='privacy' || veld==='mc4wp_checkbox';
}
