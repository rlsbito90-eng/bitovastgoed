// Helpers voor de auditweergave van afgekeurde/geskipte ruwe records.
// Pure functies — geen Supabase-aanroepen — zodat ze testbaar zijn.

import {
  parseAdres,
  detectAssettype,
  detectSignaaltype,
  detectBronType,
  dedupeHashInput,
  sha256Hex,
  formatScoreComponenten,
  type ScoreComponent,
} from './normalize';

export interface GeskiptRecord {
  id: string;
  bron_id: string;
  extern_id: string | null;
  binnengekomen_op: string;
  updated_at: string | null;
  signaal_id: string | null;
  titel: string;
  samenvatting: string;
  datum: string | null;
  link: string | null;
  subjects: string[];
  score: number;
  skip_reden: string;
  score_componenten: ScoreComponent[];
  score_componenten_tekst: string | null;
  handmatig_genegeerd: boolean;
  /** Origineel payload-object voor latere referentie/promotie. */
  payload: Record<string, unknown>;
}

export interface AuditFilters {
  bronId?: string;
  minScore?: number;
  maxScore?: number;
  zoekterm?: string;
  vanafDatum?: string; // ISO YYYY-MM-DD
  alleenTwijfel?: boolean; // 25-39
  toonGenegeerd?: boolean; // default false
}

/** Map een ruwe DB-rij naar een leesbaar GeskiptRecord. */
export function mapRuwNaarGeskipt(rij: {
  id: string;
  bron_id: string;
  extern_id: string | null;
  binnengekomen_op: string;
  updated_at: string | null;
  signaal_id: string | null;
  payload: Record<string, unknown> | null;
}): GeskiptRecord {
  const p = (rij.payload ?? {}) as Record<string, unknown>;
  const componenten = (p.score_componenten as ScoreComponent[] | undefined) ?? [];
  return {
    id: rij.id,
    bron_id: rij.bron_id,
    extern_id: rij.extern_id,
    binnengekomen_op: rij.binnengekomen_op,
    updated_at: rij.updated_at,
    signaal_id: rij.signaal_id,
    titel: (p.titel as string) ?? '(geen titel)',
    samenvatting: (p.samenvatting as string) ?? '',
    datum: (p.datum as string | null) ?? null,
    link: (p.link as string | null) ?? null,
    subjects: (p.subjects as string[] | undefined) ?? [],
    score: Number(p.score ?? 0),
    skip_reden: (p.skip_reden as string) ?? `score=${Number(p.score ?? 0)}`,
    score_componenten: componenten,
    score_componenten_tekst:
      (p.score_componenten_tekst as string | undefined) ??
      (componenten.length ? formatScoreComponenten(componenten) : null),
    handmatig_genegeerd: Boolean(p.handmatig_genegeerd),
    payload: p,
  };
}

/** Pas client-side filters toe op een lijst geskipte records. */
export function filterGeskipt(records: GeskiptRecord[], filters: AuditFilters): GeskiptRecord[] {
  const min = filters.alleenTwijfel ? 25 : filters.minScore;
  const max = filters.alleenTwijfel ? 39 : filters.maxScore;
  const term = filters.zoekterm?.trim().toLowerCase();
  const vanaf = filters.vanafDatum ? new Date(filters.vanafDatum).getTime() : null;
  return records.filter(r => {
    if (filters.bronId && r.bron_id !== filters.bronId) return false;
    if (!filters.toonGenegeerd && r.handmatig_genegeerd) return false;
    if (typeof min === 'number' && r.score < min) return false;
    if (typeof max === 'number' && r.score > max) return false;
    if (vanaf !== null) {
      const d = r.datum ? new Date(r.datum).getTime() : new Date(r.binnengekomen_op).getTime();
      if (Number.isNaN(d) || d < vanaf) return false;
    }
    if (term) {
      const blob = `${r.titel} ${r.samenvatting} ${r.subjects.join(' ')} ${r.skip_reden}`.toLowerCase();
      if (!blob.includes(term)) return false;
    }
    return true;
  });
}

/** Resultaat van een poging tot handmatig promoveren. */
export interface PromoteResult {
  /** Te inserten in off_market_signalen. */
  insertPayload: Record<string, unknown>;
  /** Te zetten in payload van ruw record na promotie. */
  ruwUpdatePayload: Record<string, unknown>;
}

/**
 * Bouw insert-payload voor handmatige promotie van een geskipt ruw record.
 * Gooit als het record al gepromoveerd is — voorkomt dubbele promotie.
 */
export async function buildHandmatigePromotie(
  record: GeskiptRecord,
  bron: { gemeente?: string | null; provincie?: string | null },
): Promise<PromoteResult> {
  if (record.signaal_id) {
    throw new Error('Dit record is al gepromoveerd naar een signaal.');
  }
  const tekstBlob = `${record.titel} ${record.samenvatting}`;
  const adresInfo = parseAdres(tekstBlob);
  const assettype = detectAssettype(tekstBlob);
  const signaaltype = detectSignaaltype(tekstBlob);
  const bronType = detectBronType(record.subjects);
  const hashInput = dedupeHashInput(adresInfo.adres, bron.gemeente ?? null, assettype, record.datum);
  const dedupeHash = await sha256Hex(hashInput);

  const compTekst =
    record.score_componenten_tekst ??
    (record.score_componenten.length ? formatScoreComponenten(record.score_componenten) : '(geen componenten)');

  const insertPayload: Record<string, unknown> = {
    titel: record.titel.slice(0, 200) || 'Onbekende bekendmaking',
    omschrijving: record.samenvatting.slice(0, 500) || null,
    adres: adresInfo.adres,
    postcode: adresInfo.postcode,
    plaats: bron.gemeente ?? null,
    provincie: bron.provincie ?? null,
    assettype,
    type_signaal: signaaltype,
    bron_type: bronType,
    bron_id: record.bron_id,
    bron_url: record.link,
    bron_referentie: record.extern_id,
    bron_datum: record.datum,
    prioriteit: 'laag',
    status: 'nieuw_signaal',
    ai_status: 'niet_verrijkt',
    dedupe_hash: dedupeHash,
    notities:
      `[handmatig gepromoveerd uit afgekeurde records]\n` +
      `originele score=${record.score} · skip_reden=${record.skip_reden}\n` +
      `score_componenten: ${compTekst}`,
  };

  const ruwUpdatePayload: Record<string, unknown> = {
    ...record.payload,
    handmatig_gepromoveerd: true,
    handmatig_gepromoveerd_op: new Date().toISOString(),
  };

  return { insertPayload, ruwUpdatePayload };
}
