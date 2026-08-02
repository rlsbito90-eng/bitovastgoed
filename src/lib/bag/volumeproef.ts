export type BagProefOmgeving = 'lokaal' | 'tijdelijk' | 'productie';
export type BagGeografischeScope = 'gemeente' | 'provincie' | 'landelijk';

export interface BagVolumeproefConfiguratie {
  naam: string;
  omgeving: BagProefOmgeving;
  scope: BagGeografischeScope;
  scopeCode: string;
  scopeNaam: string;
  bronbestand: string;
  bronPeildatum: string;
  maximaleViewportResultaten: number;
  productieSchrijfactiesToegestaan: boolean;
  crmPromotieToegestaan: boolean;
}

export interface BagObjectTellingen {
  panden: number;
  verblijfsobjecten: number;
  nummeraanduidingen: number;
  openbareRuimten: number;
  woonplaatsen: number;
  pandVboRelaties: number;
  vboAdresRelaties: number;
  geweigerd: number;
}

export interface BagFaseTijdenMs {
  uitpakken: number;
  parsen: number;
  stagingLoad: number;
  valideren: number;
  publiceren: number;
  zoekindexOpbouwen: number;
  ruimtelijkKoppelen: number;
}

export interface BagOpslagMetingBytes {
  staging: number;
  bronlaag: number;
  zoekindex: number;
  geometrieIndexen: number;
  overigeIndexen: number;
}

export type BagQueryType =
  | 'gemeente_telling'
  | 'wijk_telling'
  | 'buurt_telling'
  | 'straat_zoeken'
  | 'adres_zoeken'
  | 'pand_pagineren'
  | 'viewport_punten'
  | 'viewport_contouren'
  | 'functie_filter'
  | 'bouwjaar_filter'
  | 'gecombineerde_filter';

export interface BagQueryMeting {
  queryType: BagQueryType;
  runs: number;
  p50Ms: number;
  p95Ms: number;
  maximumMs: number;
  resultaatAantal: number;
  afgekapt: boolean;
  cache: 'koud' | 'warm';
}

export interface BagVolumeproefResultaat {
  configuratie: BagVolumeproefConfiguratie;
  objectTellingen: BagObjectTellingen;
  faseTijdenMs: BagFaseTijdenMs;
  opslagBytes: BagOpslagMetingBytes;
  queryMetingen: BagQueryMeting[];
  checksumGeverifieerd: boolean;
  importIdempotent: boolean;
  stilleUitval: number;
}

export interface BagProefValidatie {
  geldig: boolean;
  fouten: string[];
  waarschuwingen: string[];
}

const NIET_NEGATIEVE_TELLINGEN: Array<keyof BagObjectTellingen> = [
  'panden',
  'verblijfsobjecten',
  'nummeraanduidingen',
  'openbareRuimten',
  'woonplaatsen',
  'pandVboRelaties',
  'vboAdresRelaties',
  'geweigerd',
];

export function totaleFaseTijdMs(tijden: BagFaseTijdenMs): number {
  return Object.values(tijden).reduce((totaal, waarde) => totaal + waarde, 0);
}

export function totaleOpslagBytes(opslag: BagOpslagMetingBytes): number {
  return Object.values(opslag).reduce((totaal, waarde) => totaal + waarde, 0);
}

export function valideerBagVolumeproefConfiguratie(
  configuratie: BagVolumeproefConfiguratie,
): BagProefValidatie {
  const fouten: string[] = [];
  const waarschuwingen: string[] = [];

  if (!configuratie.naam.trim()) fouten.push('De proefnaam ontbreekt.');
  if (!configuratie.scopeCode.trim()) fouten.push('De geografische scopecode ontbreekt.');
  if (!configuratie.scopeNaam.trim()) fouten.push('De geografische scopenaam ontbreekt.');
  if (!configuratie.bronbestand.trim()) fouten.push('Het bronbestand ontbreekt.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(configuratie.bronPeildatum)) {
    fouten.push('De bronpeildatum moet ISO-formaat YYYY-MM-DD gebruiken.');
  }
  if (!Number.isInteger(configuratie.maximaleViewportResultaten) || configuratie.maximaleViewportResultaten < 1) {
    fouten.push('De viewportlimiet moet een positief geheel getal zijn.');
  }
  if (configuratie.maximaleViewportResultaten > 10_000) {
    waarschuwingen.push('De viewportlimiet is hoger dan 10.000 en kan de kaartrespons te zwaar maken.');
  }

  if (configuratie.omgeving === 'productie') {
    fouten.push('BUILD 2A.1 mag niet in productie worden uitgevoerd.');
  }
  if (configuratie.productieSchrijfactiesToegestaan) {
    fouten.push('Productieschrijfacties zijn binnen BUILD 2A.1 verboden.');
  }
  if (configuratie.crmPromotieToegestaan) {
    fouten.push('Automatische CRM-promotie is binnen de BAG-volumeproef verboden.');
  }
  if (configuratie.scope !== 'gemeente') {
    waarschuwingen.push('De eerste representatieve proef hoort één volledige gemeente te gebruiken.');
  }

  return { geldig: fouten.length === 0, fouten, waarschuwingen };
}

export function valideerBagVolumeproefResultaat(
  resultaat: BagVolumeproefResultaat,
): BagProefValidatie {
  const configuratieValidatie = valideerBagVolumeproefConfiguratie(resultaat.configuratie);
  const fouten = [...configuratieValidatie.fouten];
  const waarschuwingen = [...configuratieValidatie.waarschuwingen];

  for (const sleutel of NIET_NEGATIEVE_TELLINGEN) {
    const waarde = resultaat.objectTellingen[sleutel];
    if (!Number.isInteger(waarde) || waarde < 0) {
      fouten.push(`Objecttelling ${sleutel} moet een niet-negatief geheel getal zijn.`);
    }
  }

  if (resultaat.objectTellingen.panden === 0) {
    fouten.push('Een volledige gemeenteproef moet minimaal één BAG-pand bevatten.');
  }
  if (!resultaat.checksumGeverifieerd) {
    fouten.push('De checksum van het bronbestand is niet geverifieerd.');
  }
  if (!resultaat.importIdempotent) {
    fouten.push('De import is niet aantoonbaar idempotent.');
  }
  if (resultaat.stilleUitval !== 0) {
    fouten.push('De proef bevat stille uitval; ieder geweigerd record moet een reden hebben.');
  }

  const tijdwaarden = Object.values(resultaat.faseTijdenMs);
  if (tijdwaarden.some(waarde => !Number.isFinite(waarde) || waarde < 0)) {
    fouten.push('Alle fasetijden moeten geldige niet-negatieve milliseconden zijn.');
  }

  const opslagwaarden = Object.values(resultaat.opslagBytes);
  if (opslagwaarden.some(waarde => !Number.isFinite(waarde) || waarde < 0)) {
    fouten.push('Alle opslagmetingen moeten geldige niet-negatieve aantallen bytes zijn.');
  }

  if (!resultaat.queryMetingen.length) {
    waarschuwingen.push('Er zijn nog geen querymetingen geregistreerd.');
  }

  for (const meting of resultaat.queryMetingen) {
    if (!Number.isInteger(meting.runs) || meting.runs < 1) {
      fouten.push(`Querymeting ${meting.queryType} heeft geen geldig aantal runs.`);
    }
    if (meting.p50Ms < 0 || meting.p95Ms < meting.p50Ms || meting.maximumMs < meting.p95Ms) {
      fouten.push(`Querymeting ${meting.queryType} heeft ongeldige percentielen.`);
    }
    if (meting.resultaatAantal > resultaat.configuratie.maximaleViewportResultaten && meting.queryType.startsWith('viewport_') && !meting.afgekapt) {
      fouten.push(`Viewportquery ${meting.queryType} overschrijdt de limiet zonder afkappingsindicatie.`);
    }
  }

  return { geldig: fouten.length === 0, fouten, waarschuwingen };
}