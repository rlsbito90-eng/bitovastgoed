export interface BagOfficieleBron {
  id: 'xsd_pakket' | 'proefbestand_gemeente';
  url: string;
  bestandsType: 'zip';
  bronhouder: 'Kadaster';
  verwachtMinBytes: number;
}

export const BAG_OFFICIELE_BRONNEN: BagOfficieleBron[] = [
  {
    id: 'xsd_pakket',
    url: 'https://developer.kadaster.nl/schemas/lvbag-extract-v20200601.zip',
    bestandsType: 'zip',
    bronhouder: 'Kadaster',
    verwachtMinBytes: 1_000,
  },
  {
    id: 'proefbestand_gemeente',
    url: 'https://www.kadaster.nl/documents/1953498/2762071/Proefbestand%2Bgemeente.zip/24446fad-f8a8-dec5-7745-f050d7c1976b?t=1639746514279',
    bestandsType: 'zip',
    bronhouder: 'Kadaster',
    verwachtMinBytes: 10_000,
  },
];

export interface BagBronbestandInspectie {
  bronId: BagOfficieleBron['id'];
  lokaalAanwezig: boolean;
  bytes: number;
  sha256: string | null;
  zipLeesbaar: boolean;
  bestanden: string[];
  xsdValidatieUitgevoerd: boolean;
}

export interface BagBronvrijgave {
  vrijgegeven: boolean;
  fouten: string[];
}

export function valideerBagBronbestandInspectie(
  bron: BagOfficieleBron,
  inspectie: BagBronbestandInspectie,
): BagBronvrijgave {
  const fouten: string[] = [];

  if (inspectie.bronId !== bron.id) fouten.push('De inspectie hoort niet bij de gekozen officiële bron.');
  if (!inspectie.lokaalAanwezig) fouten.push('Het officiële bronbestand is niet lokaal aanwezig.');
  if (inspectie.bytes < bron.verwachtMinBytes) fouten.push('Het officiële bronbestand is onverwacht klein.');
  if (!/^[a-f0-9]{64}$/i.test(inspectie.sha256 ?? '')) fouten.push('Een geldige SHA-256-checksum ontbreekt.');
  if (!inspectie.zipLeesbaar) fouten.push('Het ZIP-bestand is niet aantoonbaar leesbaar.');
  if (inspectie.bestanden.length === 0) fouten.push('De ZIP-inhoud is niet geïnventariseerd.');

  if (bron.id === 'xsd_pakket') {
    if (!inspectie.bestanden.some(bestand => bestand.toLowerCase().endsWith('.xsd'))) {
      fouten.push('Het officiële XSD-pakket bevat volgens de inspectie geen XSD-bestanden.');
    }
    if (!inspectie.xsdValidatieUitgevoerd) fouten.push('XSD-validatie is nog niet uitgevoerd.');
  }

  if (bron.id === 'proefbestand_gemeente') {
    if (!inspectie.bestanden.some(bestand => bestand.toLowerCase().endsWith('.xml'))) {
      fouten.push('Het officiële gemeenteproefbestand bevat volgens de inspectie geen XML-bestanden.');
    }
  }

  return { vrijgegeven: fouten.length === 0, fouten };
}

export function officieleXmlMappingMagWordenVrijgegeven(
  inspecties: BagBronbestandInspectie[],
): BagBronvrijgave {
  const fouten: string[] = [];

  for (const bron of BAG_OFFICIELE_BRONNEN) {
    const inspectie = inspecties.find(item => item.bronId === bron.id);
    if (!inspectie) {
      fouten.push(`Inspectie ontbreekt voor officiële bron ${bron.id}.`);
      continue;
    }
    fouten.push(...valideerBagBronbestandInspectie(bron, inspectie).fouten);
  }

  return { vrijgegeven: fouten.length === 0, fouten };
}
