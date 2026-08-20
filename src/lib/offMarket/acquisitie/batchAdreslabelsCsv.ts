import type { BatchAdreslabelRij } from './batchAdreslabelRijen';

const KOLOMMEN = [
  'volgnummer', 'briefnummer', 'briefVersieId', 'naamregel', 'attentieregel',
  'adresregel', 'postcode', 'plaats', 'landregel',
] as const;

const SCHEIDINGSTEKEN = ';';

function csvCel(waarde: string | number | null): string {
  const tekst = waarde === null ? '' : String(waarde);
  if (!/[;"\r\n]/.test(tekst)) return tekst;
  return `"${tekst.replace(/"/g, '""')}"`;
}

/**
 * Serializeert uitsluitend reeds gevalideerde labelrijen in het formaat dat
 * Brother P-touch Editor op de Nederlandse macOS-workflow direct kan openen:
 * UTF-8 zonder BOM, puntkomma als scheidingsteken en CRLF-regelafbreking.
 * Alleen cellen die dat echt vereisen worden volgens CSV-regels geciteerd.
 */
export function serializeerBatchAdreslabelsCsv(
  rijen: readonly BatchAdreslabelRij[],
): string {
  if (rijen.length === 0) throw new Error('Adreslabels-CSV vereist minimaal één rij.');
  if (rijen.length > 1_000) throw new Error('Adreslabels-CSV mag maximaal 1000 rijen bevatten.');

  rijen.forEach((rij, index) => {
    if (rij.volgnummer !== index + 1) {
      throw new Error('Adreslabels-CSV vereist aaneengesloten volgnummers vanaf 1.');
    }
  });

  const regels = [
    KOLOMMEN.map(csvCel).join(SCHEIDINGSTEKEN),
    ...rijen.map((rij) => KOLOMMEN.map((kolom) => csvCel(rij[kolom])).join(SCHEIDINGSTEKEN)),
  ];
  return `${regels.join('\r\n')}\r\n`;
}
