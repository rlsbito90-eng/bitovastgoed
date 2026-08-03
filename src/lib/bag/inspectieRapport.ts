export type BagInspectieObjecttype =
  | 'pand'
  | 'verblijfsobject'
  | 'nummeraanduiding'
  | 'openbare_ruimte'
  | 'woonplaats'
  | 'standplaats'
  | 'ligplaats';

export interface BagInspectieBronbestand {
  naam: string;
  url: string;
  sha256: string;
  bytes: number;
  zipLeesbaar: boolean;
  bestanden: string[];
  xsdAantal: number;
  xmlAantal: number;
}

export interface BagInspectieRapport {
  gegenereerdOp: string;
  bronbestanden: BagInspectieBronbestand[];
  namespaces: string[];
  objecttypen: BagInspectieObjecttype[];
  xsdValidatieGeslaagd: boolean;
  gemeenteCode: string | null;
  fouten: string[];
}

export interface BagInspectieVrijgave {
  vrijgegeven: boolean;
  fouten: string[];
  waarschuwingen: string[];
}

const ALLE_OBJECTTYPEN: BagInspectieObjecttype[] = [
  'pand',
  'verblijfsobject',
  'nummeraanduiding',
  'openbare_ruimte',
  'woonplaats',
  'standplaats',
  'ligplaats',
];

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function uniekeGesorteerdeTeksten(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort();
}

export function normaliseerBagInspectieRapport(
  rapport: BagInspectieRapport,
): BagInspectieRapport {
  return {
    ...rapport,
    bronbestanden: [...rapport.bronbestanden]
      .map(bron => ({
        ...bron,
        naam: bron.naam.trim(),
        url: bron.url.trim(),
        sha256: bron.sha256.trim().toLowerCase(),
        bestanden: uniekeGesorteerdeTeksten(bron.bestanden),
      }))
      .sort((a, b) => a.naam.localeCompare(b.naam)),
    namespaces: uniekeGesorteerdeTeksten(rapport.namespaces),
    objecttypen: [...new Set(rapport.objecttypen)].sort(),
    fouten: uniekeGesorteerdeTeksten(rapport.fouten),
    gemeenteCode: rapport.gemeenteCode?.trim() || null,
  };
}

export function valideerBagInspectieRapport(
  invoer: BagInspectieRapport,
): BagInspectieVrijgave {
  const rapport = normaliseerBagInspectieRapport(invoer);
  const fouten: string[] = [];
  const waarschuwingen: string[] = [];

  if (rapport.bronbestanden.length < 2) {
    fouten.push('Zowel de officiële XSD-set als het officiële gemeenteproefbestand moeten zijn geïnspecteerd.');
  }

  for (const bron of rapport.bronbestanden) {
    if (!bron.url.startsWith('https://')) {
      fouten.push(`Bron ${bron.naam} gebruikt geen HTTPS.`);
    }
    if (!SHA256_PATTERN.test(bron.sha256)) {
      fouten.push(`Bron ${bron.naam} heeft geen geldige SHA-256-checksum.`);
    }
    if (!Number.isFinite(bron.bytes) || bron.bytes <= 0) {
      fouten.push(`Bron ${bron.naam} heeft geen geldige bestandsgrootte.`);
    }
    if (!bron.zipLeesbaar) {
      fouten.push(`Bron ${bron.naam} is niet als leesbaar ZIP-bestand bevestigd.`);
    }
    if (bron.bestanden.length === 0) {
      fouten.push(`Bron ${bron.naam} bevat geen geïnventariseerde bestanden.`);
    }
  }

  const totaalXsd = rapport.bronbestanden.reduce((som, bron) => som + bron.xsdAantal, 0);
  const totaalXml = rapport.bronbestanden.reduce((som, bron) => som + bron.xmlAantal, 0);

  if (totaalXsd === 0) fouten.push('De officiële broninspectie bevat geen XSD-bestanden.');
  if (totaalXml === 0) fouten.push('De officiële broninspectie bevat geen XML-proefbestanden.');
  if (rapport.namespaces.length === 0) fouten.push('Er zijn geen XML-namespaces vastgesteld.');
  if (!rapport.xsdValidatieGeslaagd) fouten.push('De officiële XML-proefbestanden zijn niet aantoonbaar tegen de XSD-set gevalideerd.');
  if (rapport.gemeenteCode !== '0106') fouten.push('Het officiële gemeenteproefbestand moet aantoonbaar gemeente Assen (0106) bevatten.');

  const ontbrekendeObjecttypen = ALLE_OBJECTTYPEN.filter(
    objecttype => !rapport.objecttypen.includes(objecttype),
  );
  if (ontbrekendeObjecttypen.length > 0) {
    fouten.push(`Niet alle BAG-objecttypen zijn aangetroffen: ${ontbrekendeObjecttypen.join(', ')}.`);
  }

  if (rapport.fouten.length > 0) {
    fouten.push(...rapport.fouten.map(fout => `Inspectieworkflow: ${fout}`));
  }

  if (rapport.namespaces.some(namespace => !namespace.startsWith('http'))) {
    waarschuwingen.push('Minstens één namespace is geen absolute HTTP(S)-URI; controleer prefixextractie.');
  }

  const uniekeFouten = uniekeGesorteerdeTeksten(fouten);
  return {
    vrijgegeven: uniekeFouten.length === 0,
    fouten: uniekeFouten,
    waarschuwingen: uniekeGesorteerdeTeksten(waarschuwingen),
  };
}

export function bagInspectieRapportFingerprint(
  rapport: BagInspectieRapport,
): string {
  return JSON.stringify(normaliseerBagInspectieRapport(rapport));
}
