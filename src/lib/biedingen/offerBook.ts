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
  /** Biedingen én de latere beslissingen, op werkelijke datum gesorteerd. */
  momenten: BiedboekMoment[];
  laatste: Bieding;
  laatsteKopersbod: Bieding | null;
  laatsteVerkopersvoorstel: Bieding | null;
  verschil: number | null;
  fase: BiedboekFase;
  isOpen: boolean;
}

export interface BiedboekMoment {
  key: string;
  bieding: Bieding;
  soort: 'bod' | 'afwijzing' | 'acceptatie' | 'intrekking' | 'verloop';
  /** Datum van de gebeurtenis, of null als historische bron die niet bevat. */
  datum: string | null;
  label: string;
  sorteertijd: number;
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

/** Een statuswijziging is een afzonderlijke gebeurtenis, geen nieuw prijsvoorstel. */
export function bouwBiedboekMomenten(rondes: Bieding[]): BiedboekMoment[] {
  const momenten: BiedboekMoment[] = [];

  for (const bieding of rondes) {
    const basisdatum = datumWaarde(bieding.bieddatum);
    const aanmaakdatum = datumWaarde(bieding.createdAt);
    const bodtijd = bieding.createdAt?.slice(0, 10) === bieding.bieddatum ? aanmaakdatum : basisdatum;

    momenten.push({
      key: bieding.id + ':bod',
      bieding, soort: 'bod', datum: bieding.bieddatum,
      label: biedRondeLabel(bieding), sorteertijd: bodtijd,
    });

    const status = effectieveStatus(bieding);
    const isKoper = bieding.richting === 'van_koper';
    const gebeurtenis =
      status === 'afgewezen' ? { soort: 'afwijzing' as const, datum: bieding.rejectedAt,
        label: isKoper ? 'Kopersbod afgewezen door verkoper' : 'Verkopersvoorstel afgewezen' } :
      status === 'geaccepteerd' ? { soort: 'acceptatie' as const, datum: bieding.acceptedAt,
        label: 'Bod geaccepteerd door verkoper' } :
      status === 'ingetrokken' ? { soort: 'intrekking' as const, datum: bieding.withdrawnAt,
        label: isKoper ? 'Kopersbod ingetrokken' : 'Verkopersvoorstel ingetrokken' } :
      status === 'verlopen' ? { soort: 'verloop' as const, datum: bieding.expiredAt ?? bieding.geldigTot, label: 'Geldigheid verlopen' } :
      null;

    if (gebeurtenis) {
      // Ontbreekt de werkelijke beslisdatum in oude data? Verzín die niet.
      // Plaats de gebeurtenis dan direct na de bijbehorende biedronde.
      momenten.push({
        key: bieding.id + ':' + gebeurtenis.soort,
        bieding, soort: gebeurtenis.soort,
        datum: gebeurtenis.datum ?? null, label: gebeurtenis.label,
        sorteertijd: gebeurtenis.datum ? datumWaarde(gebeurtenis.datum) : bodtijd + 1,
      });
    }
  }

  return momenten.sort((a, b) =>
    a.sorteertijd - b.sorteertijd ||
    (a.soort === 'bod' ? -1 : 1) - (b.soort === 'bod' ? -1 : 1) ||
    a.key.localeCompare(b.key),
  );
}

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
    const momenten = bouwBiedboekMomenten(rondes);
    const laatsteMoment = momenten[momenten.length - 1];
    const geaccepteerd = rondes.some(b => b.status === 'geaccepteerd');
    const status = effectieveStatus(laatste);
    let fase: BiedboekFase;
    if (geaccepteerd) fase = 'geaccepteerd';
    else if (laatsteMoment.soort === 'afwijzing') fase = 'afgewezen';
    else if (laatsteMoment.soort === 'intrekking') fase = 'ingetrokken';
    else if (laatsteMoment.soort === 'verloop') fase = 'verlopen';
    else if (status === 'concept') fase = 'concept';
    else if (status === 'aangepast_bod_gevraagd') fase = 'wacht_op_koper';
    else if (laatste.richting === 'van_verkoper' || laatste.richting === 'namens_verkoper') fase = 'wacht_op_koper';
    else fase = 'wacht_op_verkoper';

    const isOpen = fase === 'wacht_op_koper' || fase === 'wacht_op_verkoper';
    const verschil = isOpen && laatsteKopersbod?.bedrag != null && laatsteVerkopersvoorstel?.bedrag != null
      ? laatsteVerkopersvoorstel.bedrag - laatsteKopersbod.bedrag
      : null;

    return {
      key, objectId: laatste.objectId, relatieId: laatste.relatieId,
      rondes, momenten, laatste, laatsteKopersbod, laatsteVerkopersvoorstel,
      verschil, fase, isOpen,
    };
  }).sort((a, b) => {
    // Lopende gesprekken eerst; daarna meest recente onderhandelingsstap.
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return b.momenten[b.momenten.length - 1].sorteertijd - a.momenten[a.momenten.length - 1].sorteertijd;
  });
}
