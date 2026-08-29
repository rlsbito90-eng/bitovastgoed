// Zichtbare sorteerkeuze voor de Acquisitieselectie.
// De bestaande "Aanbevolen werkvolgorde" (sorteerWerkvolgorde) blijft intact;
// de overige opties zijn puur presentatie-sorteringen over dezelfde rijen.
import {
  sorteerWerkvolgorde,
  type ActieSubfilter,
  type SorteerRij,
  type WerkbakView,
} from '@/lib/offMarket/acquisitie/werkbak';
import type { PrintPostFilter } from '@/lib/offMarket/acquisitie/printPostFilter';

export type SorteerOptie =
  | 'aanbevolen'
  | 'nieuwste_toegevoegd'
  | 'oudste_toegevoegd'
  | 'hoogste_prioriteit'
  | 'hoogste_ai_score'
  | 'plaats_az'
  | 'procesdatum'
  | 'opvolgdatum_oudste'
  | 'opvolgdatum_nieuwste';

export const SORTEER_LABEL: Record<SorteerOptie, string> = {
  aanbevolen: 'Aanbevolen werkvolgorde',
  nieuwste_toegevoegd: 'Nieuwste toegevoegd',
  oudste_toegevoegd: 'Oudste toegevoegd',
  hoogste_prioriteit: 'Hoogste prioriteit',
  hoogste_ai_score: 'Hoogste AI-score',
  plaats_az: 'Plaats A-Z',
  procesdatum: 'Relevante procesdatum',
  opvolgdatum_oudste: 'Opvolgdatum · oudste eerst',
  opvolgdatum_nieuwste: 'Opvolgdatum · nieuwste eerst',
};

export const SORTEER_VOLGORDE: SorteerOptie[] = [
  'aanbevolen',
  'opvolgdatum_oudste',
  'opvolgdatum_nieuwste',
  'nieuwste_toegevoegd',
  'oudste_toegevoegd',
  'hoogste_prioriteit',
  'hoogste_ai_score',
  'plaats_az',
  'procesdatum',
];

export function isSorteerOptie(v: unknown): v is SorteerOptie {
  return typeof v === 'string' && (SORTEER_VOLGORDE as string[]).includes(v);
}

/** Rij met de extra velden die de presentatie-sorteringen nodig hebben. */
export interface SorteerbareRij extends SorteerRij {
  prioriteit: string | null;
  aiScore: number | null;
  plaats: string | null;
}

const PRIORITEIT_RANG: Record<string, number> = {
  urgent: 0, hoog: 1, midden: 2, laag: 3,
};

/**
 * Standaardsortering per view.
 *  - Alles / Onderzoeken / Brief voorbereiden : nieuwste toegevoegd bovenaan.
 *  - Opvolgen                                  : oudste opvolgdatum eerst.
 *  - Wachten / Afgehandeld                     : aanbevolen procesvolgorde.
 *  - Te printen / Te posten                    : nieuwste relevante procesdatum.
 */
export function standaardSortering(
  werkbak: WerkbakView,
  subfilter: ActieSubfilter,
  printPost: PrintPostFilter,
): SorteerOptie {
  if (werkbak === 'alles') return 'nieuwste_toegevoegd';
  if (werkbak === 'wachten' || werkbak === 'afgehandeld') return 'aanbevolen';
  // werkbak === 'actie'
  if (subfilter === 'opvolgen') return 'opvolgdatum_oudste';
  if (subfilter === 'printen_posten') {
    return printPost === 'alles' ? 'aanbevolen' : 'procesdatum';
  }
  if (subfilter === 'onderzoeken' || subfilter === 'brief_voorbereiden' || subfilter === 'alle') {
    return 'nieuwste_toegevoegd';
  }
  return 'aanbevolen';
}

function nieuwsteEerst(a: SorteerbareRij, b: SorteerbareRij): number {
  const ta = a.toegevoegdOp ?? '';
  const tb = b.toegevoegdOp ?? '';
  if (ta !== tb) return tb.localeCompare(ta);
  return a.signaalId.localeCompare(b.signaalId);
}

function vergelijkProcesdatum(a: SorteerbareRij, b: SorteerbareRij, richting: 'asc' | 'desc'): number {
  const da = a.ctx.procesDatum?.iso ?? '';
  const db = b.ctx.procesDatum?.iso ?? '';
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return richting === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
  }
  return nieuwsteEerst(a, b);
}

export function sorteerRijen(
  optie: SorteerOptie,
  view: WerkbakView,
  rijen: SorteerbareRij[],
): SorteerbareRij[] {
  if (optie === 'aanbevolen') {
    return sorteerWerkvolgorde(view, rijen) as SorteerbareRij[];
  }
  const arr = [...rijen];
  arr.sort((a, b) => {
    switch (optie) {
      case 'nieuwste_toegevoegd':
        return nieuwsteEerst(a, b);
      case 'oudste_toegevoegd': {
        const ta = a.toegevoegdOp ?? '';
        const tb = b.toegevoegdOp ?? '';
        if (ta !== tb) return ta.localeCompare(tb);
        return a.signaalId.localeCompare(b.signaalId);
      }
      case 'hoogste_prioriteit': {
        const ra = PRIORITEIT_RANG[a.prioriteit ?? ''] ?? 99;
        const rb = PRIORITEIT_RANG[b.prioriteit ?? ''] ?? 99;
        if (ra !== rb) return ra - rb;
        return nieuwsteEerst(a, b);
      }
      case 'hoogste_ai_score': {
        const sa = typeof a.aiScore === 'number' ? a.aiScore : -1;
        const sb = typeof b.aiScore === 'number' ? b.aiScore : -1;
        if (sa !== sb) return sb - sa;
        return nieuwsteEerst(a, b);
      }
      case 'plaats_az': {
        const pa = (a.plaats ?? '').toLocaleLowerCase('nl-NL');
        const pb = (b.plaats ?? '').toLocaleLowerCase('nl-NL');
        if (pa !== pb) {
          if (!pa) return 1;
          if (!pb) return -1;
          return pa.localeCompare(pb, 'nl-NL');
        }
        return nieuwsteEerst(a, b);
      }
      case 'procesdatum':
      case 'opvolgdatum_nieuwste':
        return vergelijkProcesdatum(a, b, 'desc');
      case 'opvolgdatum_oudste':
        return vergelijkProcesdatum(a, b, 'asc');
      default:
        return nieuwsteEerst(a, b);
    }
  });
  return arr;
}
