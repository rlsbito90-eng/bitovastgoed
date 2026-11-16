import type { BiedboekTraject } from './offerBook';

/** Voorstel voor een taak, geen automatische taak of zelfverzonden herinnering. */
export function standaardOpvolgTitel(
  traject: Pick<BiedboekTraject, 'fase'>,
  relatieNaam: string,
  objectNaam: string,
): string {
  return traject.fase === 'wacht_op_koper'
    ? `Koper opvolgen · ${relatieNaam} · ${objectNaam}`
    : `Verkoper opvolgen over bod van ${relatieNaam} · ${objectNaam}`;
}
