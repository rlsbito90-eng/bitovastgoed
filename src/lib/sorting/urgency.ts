// Domeinspecifieke sorteer-helpers (urgency buckets, slimme volgorde) per module.
// Hergebruikt bestaande logica uit taakHelpers.ts en relatieContact.ts.

import type {
  Taak, Relatie, ObjectVastgoed, Deal, Zoekprofiel, ReferentieObject,
  PipelineKandidaat, TaakPrioriteit, LeadStatus,
} from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import type { AcquisitieTarget } from '@/lib/acquisitie';
import { isTaakTeLaat, getDeadlineDateTime, isTaakVandaag, isTaakDezeWeek } from '@/lib/taakHelpers';
import { getLaatsteContactDatum, getVolgendeOpenTaak } from '@/lib/relatieContact';

// =========================================================================
// TAKEN
// =========================================================================

const PRIO_RANK: Record<TaakPrioriteit | string, number> = {
  urgent: 0, hoog: 0, normaal: 1, laag: 2,
};

/** Bucket: 0=telaat, 1=vandaag, 2=morgen, 3=dezeWeek, 4=later, 5=zonderDatum, 6=wachten, 7=afgerond/geannuleerd. */
export function getTaakUrgencyBucket(t: Taak, now: Date): number {
  if (t.status === 'afgerond' || t.status === 'geannuleerd') return 7;
  if (t.status === 'wacht_op_reactie') return 6;
  if (isTaakTeLaat(t, now)) return 0;
  if (!t.deadline) return 5;
  if (isTaakVandaag(t, now)) return 1;
  // morgen
  const morgen = new Date(now); morgen.setDate(morgen.getDate() + 1);
  if (isTaakVandaag({ deadline: t.deadline }, morgen)) return 2;
  if (isTaakDezeWeek(t, now)) return 3;
  return 4;
}

export function getTaakPrioriteitRank(p: TaakPrioriteit): number {
  return PRIO_RANK[p] ?? 9;
}

export function getTaakDeadlineMs(t: Taak): number | null {
  const dt = getDeadlineDateTime(t);
  return dt ? dt.getTime() : null;
}

/** Slimme taak-sortering: bucket → prioriteit → tijd. */
export function smartTaakCompare(now: Date) {
  return (a: Taak, b: Taak) => {
    const ba = getTaakUrgencyBucket(a, now);
    const bb = getTaakUrgencyBucket(b, now);
    if (ba !== bb) return ba - bb;
    const pa = getTaakPrioriteitRank(a.prioriteit);
    const pb = getTaakPrioriteitRank(b.prioriteit);
    if (pa !== pb) return pa - pb;
    const ta = getTaakDeadlineMs(a);
    const tb = getTaakDeadlineMs(b);
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    return a.titel.localeCompare(b.titel, 'nl', { sensitivity: 'base' });
  };
}

// =========================================================================
// RELATIES
// =========================================================================

const LEAD_WARMTE: Record<LeadStatus | string, number> = {
  actief: 0, warm: 1, lauw: 2, koud: 3,
};

export function getLeadWarmteRank(s: LeadStatus): number {
  return LEAD_WARMTE[s] ?? 9;
}

/**
 * Slim bucket voor relaties:
 *  0 = open volgende actie (open taak gekoppeld)
 *  1 = warm/actief
 *  2 = recent contact (laatste echte contact ≤ 30 dgn)
 *  3 = laatste contact > 30 dgn
 *  4 = nooit contact, overig
 *  9 = gearchiveerd/soft-deleted
 */
export function getRelatieSmartBucket(
  r: Relatie,
  contactMoments: ContactMoment[],
  taken: Taak[],
  now: Date = new Date(),
): number {
  if (r.softDeletedAt) return 9;
  const openTaak = getVolgendeOpenTaak(r.id, taken);
  if (openTaak) return 0;
  if (r.leadStatus === 'actief' || r.leadStatus === 'warm') return 1;
  const laatste = getLaatsteContactDatum(r.id, contactMoments);
  if (laatste) {
    const diff = (now.getTime() - new Date(laatste).getTime()) / 86400000;
    if (diff <= 30) return 2;
    return 3;
  }
  return 4;
}

export function smartRelatieCompare(contactMoments: ContactMoment[], taken: Taak[], now: Date = new Date()) {
  return (a: Relatie, b: Relatie) => {
    const ba = getRelatieSmartBucket(a, contactMoments, taken, now);
    const bb = getRelatieSmartBucket(b, contactMoments, taken, now);
    if (ba !== bb) return ba - bb;
    // Binnen bucket: warmste eerst, daarna laatste contact nieuwste eerst.
    const wa = getLeadWarmteRank(a.leadStatus);
    const wb = getLeadWarmteRank(b.leadStatus);
    if (wa !== wb) return wa - wb;
    const la = getLaatsteContactDatum(a.id, contactMoments);
    const lb = getLaatsteContactDatum(b.id, contactMoments);
    if (la && lb) return lb.localeCompare(la);
    if (la) return -1;
    if (lb) return 1;
    return a.bedrijfsnaam.localeCompare(b.bedrijfsnaam, 'nl', { sensitivity: 'base' });
  };
}

// =========================================================================
// OBJECTEN
// =========================================================================

const OBJECT_ACTIEF_STATUSSEN = new Set(['beschikbaar', 'te_beoordelen', 'on_hold', 'onder_optie']);

export function getObjectSmartBucket(o: ObjectVastgoed, aantalKandidaten: number): number {
  if (o.isArchived) return 9;
  if (OBJECT_ACTIEF_STATUSSEN.has(o.status as string)) {
    if (aantalKandidaten > 0) return 0;
    return 1;
  }
  return 2;
}

export function smartObjectCompare(kandidatenByObjectId: Map<string, number>) {
  return (a: ObjectVastgoed, b: ObjectVastgoed) => {
    const ka = kandidatenByObjectId.get(a.id) ?? 0;
    const kb = kandidatenByObjectId.get(b.id) ?? 0;
    const ba = getObjectSmartBucket(a, ka);
    const bb = getObjectSmartBucket(b, kb);
    if (ba !== bb) return ba - bb;
    // Recenter bijgewerkt/toegevoegd eerst
    const ua = (a as any).updatedAt ?? a.datumToegevoegd ?? '';
    const ub = (b as any).updatedAt ?? b.datumToegevoegd ?? '';
    if (ua && ub && ua !== ub) return ub.localeCompare(ua);
    return (b.datumToegevoegd ?? '').localeCompare(a.datumToegevoegd ?? '');
  };
}

// =========================================================================
// DEALS
// =========================================================================

const DEAL_FASE_RANK: Record<string, number> = {
  lead: 0, introductie: 1, interesse: 2, bezichtiging: 3, bieding: 4,
  onderhandeling: 5, closing: 6, afgerond: 7, afgevallen: 8,
};

export function getDealGewogenCommissie(d: Deal): number {
  const bedrag = d.commissieBedrag ?? 0;
  const interesse = (d.interessegraad ?? 0) / 5;
  return bedrag * interesse;
}

function dealHeeftOpenActie(d: Deal): boolean {
  return !!d.datumFollowUp && !d.isArchived;
}

export function getDealSmartBucket(d: Deal): number {
  if (d.isArchived) return 9;
  if (d.fase === 'afgerond' || d.fase === 'afgevallen') return 8;
  if (dealHeeftOpenActie(d)) return 0;
  return 1;
}

export function smartDealCompare() {
  return (a: Deal, b: Deal) => {
    const ba = getDealSmartBucket(a);
    const bb = getDealSmartBucket(b);
    if (ba !== bb) return ba - bb;
    // Urgentie: follow-up datum oplopend (eerder = urgenter)
    if (a.datumFollowUp && b.datumFollowUp && a.datumFollowUp !== b.datumFollowUp) {
      return a.datumFollowUp.localeCompare(b.datumFollowUp);
    }
    if (a.datumFollowUp && !b.datumFollowUp) return -1;
    if (!a.datumFollowUp && b.datumFollowUp) return 1;
    // Daarna gewogen commissie
    const ga = getDealGewogenCommissie(a);
    const gb = getDealGewogenCommissie(b);
    if (ga !== gb) return gb - ga;
    return (b.datumEersteContact ?? '').localeCompare(a.datumEersteContact ?? '');
  };
}

// =========================================================================
// ZOEKPROFIELEN
// =========================================================================

export function getZoekprofielSmartBucket(z: Zoekprofiel): number {
  if (z.status === 'gearchiveerd') return 9;
  if (z.status === 'actief') return 0;
  return 1;
}

export function smartZoekprofielCompare() {
  return (a: Zoekprofiel, b: Zoekprofiel) => {
    const ba = getZoekprofielSmartBucket(a);
    const bb = getZoekprofielSmartBucket(b);
    if (ba !== bb) return ba - bb;
    // Recent bijgewerkt eerst
    if (a.updatedAt && b.updatedAt && a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    if (a.updatedAt && !b.updatedAt) return -1;
    if (!a.updatedAt && b.updatedAt) return 1;
    // Hoogste prioriteit eerst (P1 hoogst, dus laag = hoog)
    const pa = a.prioriteit ?? 99;
    const pb = b.prioriteit ?? 99;
    if (pa !== pb) return pa - pb;
    return a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' });
  };
}

// =========================================================================
// ACQUISITIE-TARGETS
// =========================================================================

const ACQ_STATUS_WARMTE: Record<string, number> = {
  potentiele_verkooppositie: 0,
  verkoopbereidheid_peilen: 1,
  reactie_ontvangen: 2,
  follow_up_gepland: 3,
  eerste_benadering: 4,
  eigenaar_achterhalen: 5,
  target_gevonden: 6,
  object_aangemaakt: 8,
  niet_interessant: 9,
};

function acqIsActief(t: AcquisitieTarget): boolean {
  return t.status !== 'object_aangemaakt' && t.status !== 'niet_interessant';
}

export function getAcquisitieSmartBucket(t: AcquisitieTarget): number {
  if (!acqIsActief(t)) return 9;
  if (t.volgendeActieDatum) return 0;
  const w = ACQ_STATUS_WARMTE[t.status] ?? 9;
  if (w <= 2) return 1; // warm
  return 2;
}

export function smartAcquisitieCompare() {
  return (a: AcquisitieTarget, b: AcquisitieTarget) => {
    const ba = getAcquisitieSmartBucket(a);
    const bb = getAcquisitieSmartBucket(b);
    if (ba !== bb) return ba - bb;
    // Binnen bucket: volgende actie datum oplopend
    if (a.volgendeActieDatum && b.volgendeActieDatum && a.volgendeActieDatum !== b.volgendeActieDatum) {
      return a.volgendeActieDatum.localeCompare(b.volgendeActieDatum);
    }
    if (a.volgendeActieDatum && !b.volgendeActieDatum) return -1;
    if (!a.volgendeActieDatum && b.volgendeActieDatum) return 1;
    // Daarna warmte status
    const wa = ACQ_STATUS_WARMTE[a.status] ?? 99;
    const wb = ACQ_STATUS_WARMTE[b.status] ?? 99;
    if (wa !== wb) return wa - wb;
    // Daarna laatste actie nieuwste eerst
    if (a.laatsteActieDatum && b.laatsteActieDatum) return b.laatsteActieDatum.localeCompare(a.laatsteActieDatum);
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  };
}

// =========================================================================
// PIPELINE-KANDIDATEN (binnen fase)
// =========================================================================

const INTERESSE_RANK: Record<string, number> = {
  zeer_hoog: 0, hoog: 1, gemiddeld: 2, laag: 3, geen: 4,
};

export function smartPipelineKandidaatCompare() {
  return (a: PipelineKandidaat, b: PipelineKandidaat) => {
    // Volgende actie eerst (eerdere datum = hoger)
    const aHasActie = !!a.volgendeActie;
    const bHasActie = !!b.volgendeActie;
    if (aHasActie !== bHasActie) return aHasActie ? -1 : 1;
    if (a.volgendeActieDatum && b.volgendeActieDatum && a.volgendeActieDatum !== b.volgendeActieDatum) {
      return a.volgendeActieDatum.localeCompare(b.volgendeActieDatum);
    }
    // Interesse
    const ia = INTERESSE_RANK[a.interesseNiveau] ?? 9;
    const ib = INTERESSE_RANK[b.interesseNiveau] ?? 9;
    if (ia !== ib) return ia - ib;
    // Matchscore hoog eerst
    const ma = a.matchscore ?? -1;
    const mb = b.matchscore ?? -1;
    if (ma !== mb) return mb - ma;
    // Recent activiteit
    const la = a.laatsteContactdatum ?? '';
    const lb = b.laatsteContactdatum ?? '';
    return lb.localeCompare(la);
  };
}

// =========================================================================
// REFERENTIEOBJECTEN (geen "slim", maar default = laatst bijgewerkt)
// =========================================================================

export function defaultReferentieCompare() {
  return (a: ReferentieObject, b: ReferentieObject) => {
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  };
}
