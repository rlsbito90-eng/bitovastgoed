// V2 — Pure helpers voor de bulkvoorbereiding van fysieke brieven binnen
// de Off-Market Acquisitieselectie. Géén DB-aanroepen, géén Kadaster, BAG,
// AI of e-mail.
//
// Hergebruikt:
//   - geadresseerdeKey()  — bestaande dedupe-key per geadresseerde
//   - bouwBriefPrefill()  — bestaande prefill-helper voor naam/adres/onderwerp/tekst
//   - buildBriefViewModel() — bestaande gedeelde brief-viewmodel
//   - isVolledigPostadres() — bestaande postadresvalidatie uit readiness.ts
//
// Termen:
//   - "kandidaat" = potentiële geadresseerde voor één signaal (uit signaal
//     of bestaande brieven).
//   - "plan-item" = ingeplande (te maken/te hergebruiken/over te slaan) brief
//     voor de combinatie signaal_id + geadresseerde_key + campagne_stap + 'post'.

import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import {
  bouwBriefPrefill, buildBriefViewModel,
  type BriefViewModel,
} from '@/lib/offMarket/brief';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import { isVolledigPostadres } from '@/lib/offMarket/acquisitie/readiness';
import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';

const AFGEROND_SIGNAAL_STATUS = new Set<string>([
  'archief', 'afgevallen', 'niet_interessant',
]);

const POST_KANAAL = 'post' as const;

/** Eén potentiële geadresseerde voor een signaal binnen de bulkflow. */
export interface BulkKandidaat {
  signaalId: string;
  geadresseerdeKey: string;
  naam: string | null;
  bedrijfsnaam: string | null;
  verzendadres: string | null;
  /** Of dit kandidaat als rij standaard aangevinkt mag worden. */
  geschikt: boolean;
  /** Eerste blokkadereden (taal: NL). `null` wanneer geschikt. */
  blokkade: string | null;
  /** Labels voor extra hints (bv. "Concept aanwezig"). */
  hints: string[];
}

/**
 * Bouw kandidaten voor één signaal op basis van de signaal-eigenaar­velden
 * én bestaande (niet-gearchiveerde) brieven. Dedupliceert op
 * `geadresseerde_key`. Roept géén Kadaster of BAG aan.
 */
export function bouwKandidatenVoorSignaal(
  signaal: OffMarketSignaal,
  brieven: OffMarketBrief[],
): BulkKandidaat[] {
  const actief = brieven.filter(b => !b.archived_at);
  const perKey = new Map<string, OffMarketBrief>();
  for (const b of actief) {
    const k = b.geadresseerde_key ?? geadresseerdeKey(b);
    // Bewaar het meest recente record per key zodat naam/adres zo vers
    // mogelijk zijn.
    const bestaand = perKey.get(k);
    if (!bestaand) { perKey.set(k, b); continue; }
    const tNu = (b.updated_at ?? b.created_at ?? '');
    const tOud = (bestaand.updated_at ?? bestaand.created_at ?? '');
    if (tNu > tOud) perKey.set(k, b);
  }

  const status = (signaal.status ?? '') as string;
  const signaalGearchiveerd = AFGEROND_SIGNAAL_STATUS.has(status);

  const out: BulkKandidaat[] = [];

  for (const [key, b] of perKey.entries()) {
    const naam = (b.eigenaar_naam ?? '').trim() || null;
    const bedrijf = (b.eigenaar_bedrijfsnaam ?? '').trim() || null;
    const adres = (b.verzendadres ?? '').trim() || null;
    const heeftNaam = !!(naam || bedrijf);
    const adresOk = isVolledigPostadres(adres);
    const blokkades: string[] = [];
    if (signaalGearchiveerd) blokkades.push('Signaal is gearchiveerd of afgevallen.');
    if (!heeftNaam) blokkades.push('Geen naam of bedrijfsnaam bekend.');
    if (!adresOk) blokkades.push('Postadres is onvolledig.');
    const hints: string[] = [];
    if (b.status === 'concept' && !b.archived_at) hints.push('Concept aanwezig');
    if (b.status === 'verstuurd') hints.push('Eerder verstuurd');
    out.push({
      signaalId: signaal.id,
      geadresseerdeKey: key,
      naam, bedrijfsnaam: bedrijf, verzendadres: adres,
      geschikt: blokkades.length === 0,
      blokkade: blokkades[0] ?? null,
      hints,
    });
  }

  if (out.length === 0) {
    // Geen brieven → val terug op de signaal-eigenaargegevens (max 1).
    const a = signaal as any;
    const naam = ((a.eigenaar_naam ?? '') as string).trim() || null;
    const bedrijf = ((a.eigenaar_bedrijfsnaam ?? '') as string).trim() || null;
    const adres = ((a.eigenaar_verzendadres ?? a.eigenaar_adres ?? '') as string).trim() || null;
    const key = geadresseerdeKey({
      id: `_signaal|${signaal.id}`,
      eigenaar_naam: naam, eigenaar_bedrijfsnaam: bedrijf, verzendadres: adres,
    } as any);
    const heeftNaam = !!(naam || bedrijf);
    const adresOk = isVolledigPostadres(adres);
    const blokkades: string[] = [];
    if (signaalGearchiveerd) blokkades.push('Signaal is gearchiveerd of afgevallen.');
    if (!heeftNaam) blokkades.push('Geen naam of bedrijfsnaam bekend.');
    if (!adresOk) blokkades.push('Postadres is onvolledig.');
    if (heeftNaam || adresOk) {
      out.push({
        signaalId: signaal.id,
        geadresseerdeKey: key,
        naam, bedrijfsnaam: bedrijf, verzendadres: adres,
        geschikt: blokkades.length === 0,
        blokkade: blokkades[0] ?? null,
        hints: [],
      });
    }
  }

  // Stabiele volgorde op key zodat tests deterministisch zijn.
  out.sort((a, b) => a.geadresseerdeKey.localeCompare(b.geadresseerdeKey));
  return out;
}

// ---------------------------------------------------------------------
// Planning: aanmaken / hergebruiken / overslaan
// ---------------------------------------------------------------------

export type PlanActie = 'aanmaken' | 'hergebruiken' | 'overslaan';

export interface PlanItem {
  signaalId: string;
  geadresseerdeKey: string;
  campagneStap: CampagneStap;
  kanaal: 'post';
  actie: PlanActie;
  /** Bestaande brief (concept) die wordt hergebruikt — of `null`. */
  bestaandeBrief: OffMarketBrief | null;
  /** Reden van overslaan, indien actie='overslaan'. */
  reden: string | null;
  /** Snapshot van de bron-kandidaat — voor controle-view. */
  kandidaat: BulkKandidaat;
}

export interface PlanInput {
  /** Selectie van kandidaten (na uitsluiten door gebruiker). */
  kandidaten: BulkKandidaat[];
  /** Alle bekende brieven over de geselecteerde signalen heen. */
  brieven: OffMarketBrief[];
  campagneStap: CampagneStap;
}

/**
 * Bouw een plan voor de geselecteerde kandidaten.
 *  - Bestaande NIET-gearchiveerde post-brief met dezelfde sleutel én
 *    status='concept'  → hergebruiken.
 *  - Bestaande verstuurde/geposte post-brief met dezelfde sleutel
 *    → overslaan (al verstuurd).
 *  - Anders → aanmaken.
 *
 * Vergelijking gebeurt strikt op
 *   (signaal_id, geadresseerde_key, campagne_stap, kanaal='post').
 *
 * Een kandidaat die `geschikt=false` is wordt altijd overgeslagen met de
 * blokkade-reden.
 */
export function bouwBriefPlan({ kandidaten, brieven, campagneStap }: PlanInput): PlanItem[] {
  const idx = new Map<string, OffMarketBrief[]>();
  for (const b of brieven) {
    if (b.archived_at) continue;
    if ((b.kanaal ?? 'post') !== POST_KANAAL) continue;
    if (b.campagne_stap !== campagneStap) continue;
    const key = `${b.signaal_id}|${b.geadresseerde_key ?? geadresseerdeKey(b)}`;
    const arr = idx.get(key) ?? [];
    arr.push(b);
    idx.set(key, arr);
  }

  const out: PlanItem[] = [];
  for (const k of kandidaten) {
    const base = {
      signaalId: k.signaalId, geadresseerdeKey: k.geadresseerdeKey,
      campagneStap, kanaal: POST_KANAAL,
      kandidaat: k,
    } as const;
    if (!k.geschikt) {
      out.push({
        ...base, actie: 'overslaan', bestaandeBrief: null,
        reden: k.blokkade ?? 'Geadresseerde is niet geschikt voor briefverzending.',
      });
      continue;
    }
    const matches = idx.get(`${k.signaalId}|${k.geadresseerdeKey}`) ?? [];
    const verstuurd = matches.find(b => b.status === 'verstuurd');
    if (verstuurd) {
      out.push({
        ...base, actie: 'overslaan', bestaandeBrief: verstuurd,
        reden: 'Er is al een verstuurde brief voor deze geadresseerde en stap.',
      });
      continue;
    }
    const concept = matches.find(b => b.status === 'concept');
    if (concept) {
      out.push({
        ...base, actie: 'hergebruiken', bestaandeBrief: concept, reden: null,
      });
      continue;
    }
    out.push({ ...base, actie: 'aanmaken', bestaandeBrief: null, reden: null });
  }
  return out;
}

export interface PlanSamenvatting {
  totaal: number;
  aanmaken: number;
  hergebruiken: number;
  overslaan: number;
  uniekeSignalen: number;
  uniekeGeadresseerden: number;
}

export function samenvatPlan(plan: PlanItem[]): PlanSamenvatting {
  const signalen = new Set<string>();
  const geadresseerden = new Set<string>();
  let aanmaken = 0, hergebruiken = 0, overslaan = 0;
  for (const p of plan) {
    signalen.add(p.signaalId);
    geadresseerden.add(`${p.signaalId}|${p.geadresseerdeKey}`);
    if (p.actie === 'aanmaken') aanmaken += 1;
    else if (p.actie === 'hergebruiken') hergebruiken += 1;
    else overslaan += 1;
  }
  return {
    totaal: plan.length, aanmaken, hergebruiken, overslaan,
    uniekeSignalen: signalen.size,
    uniekeGeadresseerden: geadresseerden.size,
  };
}

// ---------------------------------------------------------------------
// View-model bouw voor een planitem — gebruikt door PDF-preview en de
// "Concepten opslaan"-actie.
// ---------------------------------------------------------------------

/**
 * Geef het BriefViewModel voor een plan-item. Hergebruikt de bestaande
 * `bouwBriefPrefill` zodat objectomschrijving, aanhef en standaardtekst
 * exact gelijk zijn aan de single-signaal flow. Wanneer een bestaande
 * brief wordt hergebruikt, blijft de handmatig aangepaste tekst leidend.
 */
export function viewModelVoorPlanItem(args: {
  signaal: OffMarketSignaal;
  plan: PlanItem;
}): BriefViewModel {
  const { signaal, plan } = args;
  const prefill = bouwBriefPrefill(signaal, [], []);
  const k = plan.kandidaat;
  const b = plan.bestaandeBrief;
  return buildBriefViewModel({
    eigenaarNaam: b?.eigenaar_naam ?? k.naam ?? prefill.eigenaarNaam,
    eigenaarBedrijfsnaam: b?.eigenaar_bedrijfsnaam ?? k.bedrijfsnaam ?? prefill.eigenaarBedrijfsnaam,
    verzendadres: b?.verzendadres ?? k.verzendadres ?? prefill.verzendadres,
    objectomschrijving: b?.objectomschrijving ?? prefill.objectomschrijving,
    onderwerp: b?.onderwerp ?? prefill.onderwerp,
    brieftekst: b?.brieftekst ?? prefill.brieftekst,
  });
}

/**
 * Bouw insert-payload voor een nieuwe brief op basis van een plan-item.
 * Wordt ingevoerd via `useUpsertBrief` zodat dezelfde DB-paden en audit-
 * events als bij de single-flow worden gebruikt.
 */
export function inserPayloadVoorPlanItem(args: {
  signaal: OffMarketSignaal;
  plan: PlanItem;
}) {
  const vm = viewModelVoorPlanItem(args);
  const prefill = bouwBriefPrefill(args.signaal, [], []);
  return {
    signaal_id: args.signaal.id,
    eigenaar_naam: vm.geadresseerdeNaam || null,
    eigenaar_bedrijfsnaam: vm.bedrijfsnaam || null,
    verzendadres: vm.verzendadres || null,
    objectadres: prefill.objectadres || null,
    objectomschrijving: vm.objectomschrijving || null,
    aanhef: prefill.aanhef,
    onderwerp: vm.onderwerp,
    brieftekst: vm.brieftekst,
    status: 'concept' as const,
    kanaal: 'post' as const,
    campagne_stap: args.plan.campagneStap,
    geadresseerde_key: args.plan.geadresseerdeKey,
    verzendstatus: 'concept' as const,
  };
}
