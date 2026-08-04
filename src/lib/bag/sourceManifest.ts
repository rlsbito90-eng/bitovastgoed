export interface BagBronbestandManifestItem {
  pad: string;
  sha256: string;
  bytes: number;
  type: 'objecten' | 'voorkomens' | 'relaties' | 'geometrieen' | 'overig';
}

export interface BagBronpakketManifest {
  manifestVersie: 1;
  scopeCode: string;
  scopeNaam: string;
  leverancier: 'Kadaster';
  product: 'BAG Extract';
  leverdatum: string;
  ontvangenOp: string;
  bronUrlRegistratie: string;
  bestanden: BagBronbestandManifestItem[];
  verwachteTellingen: {
    objecten: number;
    voorkomens: number;
    relaties: number;
    geometrieen: number;
  };
}

export interface BagBronpakketValidatie {
  geldig: boolean;
  fouten: string[];
  waarschuwingen: string[];
  totaalBytes: number;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const ISO_DATUM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GEMEENTECODE_PATTERN = /^\d{4}$/;

function positiefGeheelGetal(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function valideerBagBronpakketManifest(
  manifest: BagBronpakketManifest,
  verwachteScopeCode: string,
): BagBronpakketValidatie {
  const fouten: string[] = [];
  const waarschuwingen: string[] = [];

  if (manifest.manifestVersie !== 1) fouten.push('Onbekende manifestversie.');
  if (!GEMEENTECODE_PATTERN.test(manifest.scopeCode)) fouten.push('Scopecode moet uit vier cijfers bestaan.');
  if (manifest.scopeCode !== verwachteScopeCode) fouten.push('Scopecode komt niet overeen met de bedoelde importscope.');
  if (!manifest.scopeNaam.trim()) fouten.push('Scopenaam ontbreekt.');
  if (manifest.leverancier !== 'Kadaster' || manifest.product !== 'BAG Extract') {
    fouten.push('Alleen het officiele Kadaster BAG Extract is toegestaan.');
  }
  if (!ISO_DATUM_PATTERN.test(manifest.leverdatum)) fouten.push('Leverdatum moet YYYY-MM-DD zijn.');
  if (!ISO_DATUM_PATTERN.test(manifest.ontvangenOp)) fouten.push('Ontvangstdatum moet YYYY-MM-DD zijn.');
  if (!manifest.bronUrlRegistratie.trim()) fouten.push('Bron-URL-registratie ontbreekt.');
  if (!manifest.bestanden.length) fouten.push('Bronpakket bevat geen geregistreerde bestanden.');

  const paden = new Set<string>();
  const checksums = new Set<string>();
  for (const bestand of manifest.bestanden) {
    if (!bestand.pad.trim()) fouten.push('Een bronbestand heeft geen pad.');
    if (paden.has(bestand.pad)) fouten.push(`Dubbel bestandspad: ${bestand.pad}`);
    paden.add(bestand.pad);

    const checksum = bestand.sha256.toLowerCase();
    if (!SHA256_PATTERN.test(checksum)) fouten.push(`Ongeldige SHA-256 voor ${bestand.pad || 'onbekend bestand'}.`);
    if (checksums.has(checksum)) waarschuwingen.push(`Dezelfde checksum komt meerdere keren voor: ${checksum}.`);
    checksums.add(checksum);

    if (!positiefGeheelGetal(bestand.bytes)) fouten.push(`Ongeldige bestandsgrootte voor ${bestand.pad || 'onbekend bestand'}.`);
  }

  const tellingen = manifest.verwachteTellingen;
  if (!positiefGeheelGetal(tellingen.objecten)) fouten.push('Verwachte objecttelling ontbreekt of is ongeldig.');
  if (!positiefGeheelGetal(tellingen.voorkomens)) fouten.push('Verwachte voorkomentelling ontbreekt of is ongeldig.');
  if (!positiefGeheelGetal(tellingen.relaties)) fouten.push('Verwachte relatietelling ontbreekt of is ongeldig.');
  if (!positiefGeheelGetal(tellingen.geometrieen)) fouten.push('Verwachte geometrietelling ontbreekt of is ongeldig.');

  const verplichteTypen = new Set(['objecten', 'voorkomens', 'relaties', 'geometrieen']);
  manifest.bestanden.forEach(bestand => verplichteTypen.delete(bestand.type));
  if (verplichteTypen.size) fouten.push(`Ontbrekende bronbestandstypen: ${[...verplichteTypen].join(', ')}.`);

  return {
    geldig: fouten.length === 0,
    fouten,
    waarschuwingen,
    totaalBytes: manifest.bestanden.reduce((totaal, bestand) => totaal + Math.max(0, bestand.bytes || 0), 0),
  };
}

export function bouwBagDatasetversieIdentiteit(manifest: BagBronpakketManifest): string {
  const checksums = [...manifest.bestanden]
    .sort((a, b) => a.pad.localeCompare(b.pad))
    .map(bestand => bestand.sha256.toLowerCase())
    .join(':');
  return `${manifest.scopeCode}:${manifest.leverdatum}:${checksums}`;
}
