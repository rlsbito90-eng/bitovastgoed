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
  bepaalAanhef, bouwBriefPrefill, buildBriefViewModel,
  type BriefViewModel,
} from '@/lib/offMarket/brief';
import { bepaalCopyProfiel, kiesCopyVariant } from '@/lib/acquisitie/copyExperimenten';
import { bouwPostVariantTemplate } from '@/lib/acquisitie/postCopyVarianten';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import { isVolledigPostadres } from '@/lib/offMarket/acquisitie/readiness';
import { canoniekeRechthebbenden } from '@/lib/offMarket/acquisitie/readinessRechthebbenden';
import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';
import { naarVoorlettersAchternaam } from '@/lib/format/naam';

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
    const rauweNaam = (b.eigenaar_naam ?? '').trim() || null;
    const naam = rauweNaam ? naarVoorlettersAchternaam(rauweNaam) || null : null;
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
    const a = signaal as any;
    // Gebruik vóór de eerste brief exact dezelfde canonieke rechthebbenden
    // als de readiness-rij. Zo verdwijnen meerdere zichtbare geadresseerden
    // niet wanneer de briefwizard wordt geopend.
    if (a.eigenaar_controle_nodig !== true) {
      for (const [index, rechthebbende] of canoniekeRechthebbenden(signaal).entries()) {
        const rauweNaam = (rechthebbende.naam ?? '').trim() || null;
        const naam = rauweNaam ? naarVoorlettersAchternaam(rauweNaam) || null : null;
        const bedrijf = (rechthebbende.bedrijfsnaam ?? '').trim() || null;
        if (!naam && !bedrijf) continue;
        const adres = (rechthebbende.verzendadres ?? '').trim() || null;
        const sleutelBron = (rechthebbende.kvk ?? '').trim()
          || (rechthebbende.bedrijfsnaam ?? '').trim()
          || (rechthebbende.naam ?? '').trim()
          || `${index}`;
        const blokkades: string[] = [];
        if (signaalGearchiveerd) blokkades.push('Signaal is gearchiveerd of afgevallen.');
        if (!isVolledigPostadres(adres)) blokkades.push('Postadres is onvolledig.');
        out.push({
          signaalId: signaal.id,
          geadresseerdeKey: `_rechthebbende|${signaal.id}|${sleutelBron.toLowerCase()}`,
          naam,
          bedrijfsnaam: bedrijf,
          verzendadres: adres,
          geschikt: blokkades.length === 0,
          blokkade: blokkades[0] ?? null,
          hints: ['Canonieke rechthebbende'],
        });
      }
    }
  }

  if (out.length === 0) {
    // Geen brieven/rechthebbenden → val terug op eigenaarvelden (max 1).
    const a = signaal as any;
    const rauweNaam = ((a.eigenaar_naam ?? '') as string).trim() || null;
    const naam = rauweNaam ? naarVoorlettersAchternaam(rauweNaam) || null : null;
    const bedrijf = ((a.eigenaar_bedrijfsnaam ?? '') as string).trim() || null;
    const adres = ((a.eigenaar_verzendadres ?? a.eigenaar_adres ?? '') as string).trim() || null;
    const key = geadresseerdeKey({
      id: `_signaal|${signaal.id}`,
      eigenaar_naam: rauweNaam, eigenaar_bedrijfsnaam: bedrijf, verzendadres: adres,
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

export type RadarProductieReden =
  | 'geen_actief_postconcept'
  | 'postadres_onvolledig'
  | 'geadresseerde_ontbreekt';

export interface CanoniekeRadarSelectieScope {
  signaalIds: string[];
  kandidaten: BulkKandidaat[];
  actievePostbrieven: OffMarketBrief[];
  conceptbrieven: OffMarketBrief[];
  definitieveBrieven: OffMarketBrief[];
  nietGereed: Array<{
    signaalId: string;
    briefId: string | null;
    reden: RadarProductieReden;
  }>;
  telling: {
    signalen: number;
    geadresseerden: number;
    brievenVoorTeBereiden: number;
    conceptbrieven: number;
    definitieveBrieven: number;
    nietGereed: number;
  };
}

/**
 * Eén canonieke, read-only scope voor alle Radar-bulkacties.
 *
 * De expliciet geselecteerde signaal-IDs blijven altijd de bron. Afgeleide
 * kandidaten en brieven mogen die scope niet verkleinen. Daardoor blijft een
 * signaal zonder geadresseerde of concept zichtbaar als `nietGereed` in plaats
 * van stil uit een teller of productiestap te verdwijnen.
 */
export function bouwCanoniekeRadarSelectieScope(
  signalen: readonly OffMarketSignaal[],
  brieven: readonly OffMarketBrief[],
): CanoniekeRadarSelectieScope {
  const signaalIds = [...new Set(signalen.map((signaal) => signaal.id))];
  const geselecteerd = new Set(signaalIds);
  const brievenPerSignaal = new Map<string, OffMarketBrief[]>();

  for (const brief of brieven) {
    if (!geselecteerd.has(brief.signaal_id)) continue;
    const lijst = brievenPerSignaal.get(brief.signaal_id) ?? [];
    lijst.push(brief);
    brievenPerSignaal.set(brief.signaal_id, lijst);
  }

  const kandidaten = signalen.flatMap((signaal) =>
    bouwKandidatenVoorSignaal(signaal, brievenPerSignaal.get(signaal.id) ?? []),
  );
  const actievePostbrieven = brieven.filter((brief) =>
    geselecteerd.has(brief.signaal_id)
      && !brief.archived_at
      && (brief.kanaal ?? 'post') === 'post'
      && (brief.status === 'concept' || brief.status === 'definitief'),
  );
  const conceptbrieven = actievePostbrieven.filter((brief) => brief.status === 'concept');
  const definitieveBrieven = actievePostbrieven.filter((brief) => brief.status === 'definitief');
  const nietGereed: CanoniekeRadarSelectieScope['nietGereed'] = [];
  const conceptenPerSignaal = new Map<string, OffMarketBrief[]>();
  const signalenMetDefinitieveBrief = new Set(definitieveBrieven.map((brief) => brief.signaal_id));
  for (const brief of conceptbrieven) {
    const lijst = conceptenPerSignaal.get(brief.signaal_id) ?? [];
    lijst.push(brief);
    conceptenPerSignaal.set(brief.signaal_id, lijst);
  }

  for (const signaalId of signaalIds) {
    const concepten = conceptenPerSignaal.get(signaalId) ?? [];
    if (concepten.length === 0 && !signalenMetDefinitieveBrief.has(signaalId)) {
      nietGereed.push({ signaalId, briefId: null, reden: 'geen_actief_postconcept' });
      continue;
    }
    for (const brief of concepten) {
      if (!((brief.eigenaar_naam ?? '').trim() || (brief.eigenaar_bedrijfsnaam ?? '').trim())) {
        nietGereed.push({ signaalId, briefId: brief.id, reden: 'geadresseerde_ontbreekt' });
      } else if (!isVolledigPostadres(brief.verzendadres)) {
        nietGereed.push({ signaalId, briefId: brief.id, reden: 'postadres_onvolledig' });
      }
    }
  }

  const uniekeGeadresseerden = new Set(
    kandidaten.map((kandidaat) => `${kandidaat.signaalId}|${kandidaat.geadresseerdeKey}`),
  );

  return {
    signaalIds,
    kandidaten,
    actievePostbrieven,
    conceptbrieven,
    definitieveBrieven,
    nietGereed,
    telling: {
      signalen: signaalIds.length,
      geadresseerden: uniekeGeadresseerden.size,
      brievenVoorTeBereiden: kandidaten.filter((kandidaat) => kandidaat.geschikt).length,
      conceptbrieven: conceptbrieven.length,
      definitieveBrieven: definitieveBrieven.length,
      nietGereed: nietGereed.length,
    },
  };
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
    eigenaarNaam: b?.eigenaar_naam ? naarVoorlettersAchternaam(b.eigenaar_naam) : (k.naam ?? prefill.eigenaarNaam),
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
  return standaardtekstPayloadVoorPlanItem(args);
}

/**
 * Payload voor een nieuw concept of een expliciet aangevraagde bulkvernieuwing.
 * Adressering en objectomschrijving van een bestaand concept blijven intact;
 * alleen onderwerp/brieftekst worden opnieuw uit de actuele vastgelegde
 * copyvariant opgebouwd.
 */
export function standaardtekstPayloadVoorPlanItem(args: {
  signaal: OffMarketSignaal;
  plan: PlanItem;
}) {
  const prefill = bouwBriefPrefill(args.signaal, [], []);
  const kandidaat = args.plan.kandidaat;
  const bestaande = args.plan.bestaandeBrief;
  const eigenaarNaam = bestaande?.eigenaar_naam
    ? naarVoorlettersAchternaam(bestaande.eigenaar_naam)
    : kandidaat.naam;
  const aanhef = bestaande?.aanhef?.trim() || bepaalAanhef(eigenaarNaam || null);
  const objectomschrijving = bestaande?.objectomschrijving?.trim() || prefill.objectomschrijving;
  const berekendeToewijzing = kiesCopyVariant({
    profiel: bepaalCopyProfiel({ signaal: args.signaal, kanaal: 'post' }),
    kanaal: 'post',
    campagneStap: args.plan.campagneStap,
    signaalId: args.signaal.id,
    geadresseerdeKey: args.plan.geadresseerdeKey,
  });
  const toewijzing = bestaande?.copy_profiel && bestaande.copy_variant_key && bestaande.copy_variant_code
    ? {
        profiel: bestaande.copy_profiel,
        variantKey: bestaande.copy_variant_key,
        variantCode: bestaande.copy_variant_code,
        hypothese: bestaande.copy_hypothese ?? berekendeToewijzing.hypothese,
      }
    : berekendeToewijzing;
  const template = bouwPostVariantTemplate({ toewijzing, aanhef, objectomschrijving });
  return {
    signaal_id: args.signaal.id,
    eigenaar_naam: eigenaarNaam || null,
    eigenaar_bedrijfsnaam: bestaande?.eigenaar_bedrijfsnaam ?? kandidaat.bedrijfsnaam ?? null,
    verzendadres: bestaande?.verzendadres ?? kandidaat.verzendadres ?? null,
    objectadres: prefill.objectadres || null,
    objectomschrijving: objectomschrijving || null,
    aanhef,
    onderwerp: template.onderwerp,
    brieftekst: template.brieftekst,
    status: 'concept' as const,
    kanaal: 'post' as const,
    campagne_stap: args.plan.campagneStap,
    geadresseerde_key: args.plan.geadresseerdeKey,
    verzendstatus: 'concept' as const,
    copy_profiel: toewijzing.profiel,
    copy_variant_key: toewijzing.variantKey,
    copy_variant_code: toewijzing.variantCode,
    copy_hypothese: toewijzing.hypothese,
  };
}
