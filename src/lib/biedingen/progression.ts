import { PIPELINE_FASES, type PipelineFase } from '@/data/mock-data';
import type { Bieding, BiedingRichting, BiedingStatus } from './types';

const PHASE_ORDER = new Map(PIPELINE_FASES.map((fase, index) => [fase.key, index]));
const NO_PROGRESS = new Set<BiedingStatus>(['concept', 'afgewezen', 'ingetrokken', 'verlopen']);

export function getOfferProgressTarget(
  bieding: Pick<Bieding, 'status' | 'offerType' | 'richting' | 'counterOfferToId'>,
): PipelineFase | null {
  if (NO_PROGRESS.has(bieding.status) || bieding.richting === 'intern') return null;
  if (bieding.status === 'geaccepteerd') return 'onderhandeling';

  const isOnderhandeling =
    !!bieding.counterOfferToId ||
    bieding.offerType === 'tegenvoorstel' ||
    bieding.offerType === 'verhoogd_bod' ||
    bieding.richting === 'van_verkoper' ||
    bieding.richting === 'namens_verkoper' ||
    bieding.status === 'tegenvoorstel_gedaan' ||
    bieding.status === 'aangepast_bod_gevraagd';

  if (isOnderhandeling) return 'onderhandeling';
  if (bieding.richting === 'van_koper') return 'indicatieve_bieding';
  return null;
}

export function shouldAdvanceCandidate(current: PipelineFase, target: PipelineFase): boolean {
  if (current === 'afgerond') return false;
  if (current === 'afgevallen') return true;
  return (PHASE_ORDER.get(target) ?? -1) > (PHASE_ORDER.get(current) ?? -1);
}

export function nextCounterDirection(richting: BiedingRichting): BiedingRichting {
  if (richting === 'van_koper') return 'van_verkoper';
  if (richting === 'van_verkoper' || richting === 'namens_verkoper') return 'van_koper';
  return 'van_koper';
}

export function counterStatusForDirection(richting: BiedingRichting): BiedingStatus {
  return richting === 'van_koper' ? 'ontvangen' : 'tegenvoorstel_gedaan';
}

export interface NegotiationPosition {
  relatieId: string;
  latestBuyer: Bieding | null;
  latestSeller: Bieding | null;
  gap: number | null;
}

const positionTimestamp = (b: Bieding) => new Date(b.createdAt || b.bieddatum).getTime();
const isPositionRecord = (b: Bieding) => !['concept', 'afgewezen', 'ingetrokken', 'verlopen'].includes(b.status);

export function getNegotiationPositions(items: Bieding[]): NegotiationPosition[] {
  const byRelatie = new Map<string, Bieding[]>();
  for (const item of items.filter(isPositionRecord)) {
    const list = byRelatie.get(item.relatieId) ?? [];
    list.push(item);
    byRelatie.set(item.relatieId, list);
  }

  return [...byRelatie.entries()].map(([relatieId, list]) => {
    const buyer = list.filter(b => b.richting === 'van_koper').sort((a, b) => positionTimestamp(b) - positionTimestamp(a))[0] ?? null;
    const seller = list.filter(b => b.richting === 'van_verkoper' || b.richting === 'namens_verkoper').sort((a, b) => positionTimestamp(b) - positionTimestamp(a))[0] ?? null;
    const gap = buyer?.bedrag != null && seller?.bedrag != null ? seller.bedrag - buyer.bedrag : null;
    return { relatieId, latestBuyer: buyer, latestSeller: seller, gap };
  });
}
