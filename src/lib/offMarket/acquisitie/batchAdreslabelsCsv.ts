import type { BatchAdreslabelRij } from './batchAdreslabelRijen';

const KOLOMMEN = ['Nummer', 'Regel1', 'Regel2', 'Regel3', 'Regel4'] as const;
const SCHEIDINGSTEKEN = ';';

function csvCel(waarde: string | number | null): string {
  const tekst = waarde === null ? '' : String(waarde);
  if (!/[;"\r\n]/.test(tekst)) return tekst;
  return `"${tekst.replace(/"/g, '""')}"`;
}

function formatPostcodePlaats(postcode: string, plaats: string): string {
  const pc = postcode.trim().toUpperCase();
  const nederlands = pc.match(/^(\d{4})([A-Z]{2})$/);
  const leesbaar = nederlands ? `${nederlands[1]} ${nederlands[2]}` : pc;
  return `${leesbaar} ${plaats.trim().toUpperCase()}`.trim();
}

function naarBrotherRegels(rij: BatchAdreslabelRij): [number, string, string, string, string] {
  const postcodePlaats = formatPostcodePlaats(rij.postcode, rij.plaats);

  // Eén vaste vier-regel-template voor alle geadresseerden:
  // bedrijf NL: naam / directie / straat / postcode+plaats
  // persoon NL: naam / straat / postcode+plaats / leeg
  // buitenland: naam / straat / postcode+plaats / land
  if (rij.attentieregel) {
    return [rij.volgnummer, rij.naamregel, rij.attentieregel, rij.adresregel, postcodePlaats];
  }
  if (rij.landregel) {
    return [rij.volgnummer, rij.naamregel, rij.adresregel, postcodePlaats, rij.landregel];
  }
  return [rij.volgnummer, rij.naamregel, rij.adresregel, postcodePlaats, ''];
}

/**
 * Brother P-touch export voor één vaste Bito-template met vier adresregels.
 * UTF-8 zonder BOM, puntkomma als scheidingsteken en CRLF-regelafbreking.
 * BR/BAT-identiteit blijft in de Productiekern zelf bewaard; de fysieke label-
 * database bevat bewust alleen het volgnummer en de vier printregels.
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
    ...rijen.map((rij) => naarBrotherRegels(rij).map(csvCel).join(SCHEIDINGSTEKEN)),
  ];
  return `${regels.join('\r\n')}\r\n`;
}
