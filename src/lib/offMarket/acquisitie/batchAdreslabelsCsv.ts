import type { BatchAdreslabelRij } from './batchAdreslabelRijen';

const KOLOMMEN = [
  'volgnummer', 'briefnummer', 'briefVersieId', 'naamregel', 'attentieregel',
  'adresregel', 'postcode', 'plaats', 'landregel',
] as const;

function csvCel(waarde: string | number | null): string {
  const tekst = waarde === null ? '' : String(waarde);
  return `"${tekst.replace(/"/g, '""')}"`;
}

/**
 * Serializeert uitsluitend reeds gevalideerde labelrijen. UTF-8 BOM ondersteunt
 * praktisch openen in spreadsheetsoftware; CRLF maakt het bestand printdienstvriendelijk.
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
    KOLOMMEN.map(csvCel).join(','),
    ...rijen.map((rij) => KOLOMMEN.map((kolom) => csvCel(rij[kolom])).join(',')),
  ];
  return `\uFEFF${regels.join('\r\n')}\r\n`;
}
