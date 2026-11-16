import type { Bieding } from './types';
import { effectieveStatus } from './format';

export type BiedboekFase =
  | 'concept'
  | 'wacht_op_verkoper'
  | 'wacht_op_koper'
  | 'geaccepteerd'
  | 'afgewezen'
  | 'ingetrokken'
  | 'verlopen';

export interface BiedboekTraject {
  key: string;
  objectId: string;
  relatieId: string;
  /** Alle rondes, oudste eerst. Inclusief afgewezen en ingetrokken biedingen. */
  rondes: Bieding[];
  laatste: Bieding;
  laatsteKopersbod: Bieding | null;
  laatsteVerkopersvoorstel: Bieding | null;
  verschil: number | null;
  fase: BiedboekFase;
  isOpen: boolean;
}

const datumWaarde = (waarde?: string | null) => {
  const n = Date.parse(waarde || '');
  return Number.isFinite(n) ? n : 0;
};

/** Sorteer op ingevoerde bieddatum en daarna registratievolgorde. */
export function vergelijkBiedRondes(a: Bieding, b: Bieding): number {
  return datumWaarde(a.bieddatum) - datumWaarde(b.bieddatum)
    || datumWaarde(a.createdAt) - datumWaarde(b.createdAt)
    || a.id.localeCompare(b.id);
}

export function biedRondeLabel(b: Bieding): string {
  if (b.richting === 'intern') return 'Intern prijsvoorstel';
  if (b.richting === 'van_verkoper') return b.counterOfferToId ? 'Tegenvoorstel verkoper' : 'Voorstel verkoper';
  if (b.richting === 'namens_verkoper') return 'Voorstel namens verkoper';
  return b.counterOfferToId ? 'Tegenbod koper' : 'Bod koper';
}

export const BIEDBOEK_FASE_LABELS: Record<BiedboekFase, string> = {
  concept: 'Concept',
  wacht_op_verkoper: 'Reactie verkoper nodig',
  wacht_op_koper: 'Reactie koper afwachten',
  geaccepteerd: 'Geaccepteerd',
  afgewezen: 'Afgewezen',
  ingetrokken: 'Ingetrokken',
  verlopen: 'Verlopen',
};

/**
 * Één gesprek per object én koper. Geen schemawijziging nodig:
 * bestaande counter_offer_to_id verwijzingen blijven intact.
 * Afgewezen rondes verdwijnen nooit uit het biedboek.
 */
export function bouwBiedboek(items: Bieding[]): BiedboekTraject[] {
  const groepen = new Map<string, Bieding[]>();
  for (const b of items) {
    const key = JSON.stringify([b.objectId, b.relatieId]);
    const rondes = groepen.get(key) ?? [];
    rondes.push(b);
    groepen.set(key, rondes);
  }

  return [...groepen.entries()].map(([key, ongeordend]) => {
    const rondes = [...ongeordend].sort(vergelijkBiedRondes);
    const laatste = rondes[rondes.length - 1];
    const laatsteKopersbod = [...rondes].reverse().find(b => b.richting === 'van_koper' && b.bedrag != null) ?? null;
    const laatsteVerkopersvoorstel = [...rondes].reverse().find(b =>
      (b.richting === 'van_verkoper' || b.richting === 'namens_verkoper') && b.bedrag != null,
    ) ?? null;
    const geaccepteerd = rondes.some(b => b.status === 'geaccepteerd');
    const status = effectieveStatus(laatste);
    let fase: BiedboekFase;
    if (geaccepteerd) fase = 'geaccepteerd';
    else if (status === 'afgewezen' || status === 'ingetrokken' || status === 'verlopen') fase = status;
    else if (status === 'concept') fase = 'concept';
    else if (laatste.richting === 'van_verkoper' || laatste.richting === 'namens_verkoper') fase = 'wacht_op_koper';
    else fase = 'wacht_op_verkoper';

    const isOpen = fase === 'wacht_op_koper' || fase === 'wacht_op_verkoper';
    const verschil = isOpen && laatsteKopersbod?.bedrag != null && laatsteVerkopersvoorstel?.bedrag != null
      ? laatsteVerkopersvoorstel.bedrag - laatsteKopersbod.bedrag
      : null;

    return {
      key, objectId: laatste.objectId, relatieId: laatste.relatieId,
      rondes, laatste, laatsteKopersbod, laatsteVerkopersvoorstel,
      verschil, fase, isOpen,
    };
  }).sort((a, b) => {
    // Lopende gesprekken eerst; daarna meest recente onderhandelingsstap.
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return vergelijkBiedRondes(b.laatste, a.laatste);
  });
}
