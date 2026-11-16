import type { BiedboekTraject } from './offerBook';

/** Voorstel voor een taak, geen automatische taak of zelfverzonden herinnering. */
export function standaardOpvolgTitel(
  traject: Pick<BiedboekTraject, 'fase'>,
  relatieNaam: string,
  objectNaam: string,
): string {
  const partij = traject.fase === 'wacht_op_koper' ? 'Koper' : 'Verkoper';
  return `${partij} opvolgen · ${relatieNaam} · ${objectNaam}`;
}
