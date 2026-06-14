// Pure planning-helpers voor de Off-Market sync-scheduler.
// Geen Supabase-calls, geen Date.now() (alles via `now` parameter) → testbaar.
// Gebruikt Europe/Amsterdam als wall-clock voor frequentie-planning.

export type Frequentie = 'handmatig' | 'dagelijks' | 'wekelijks' | 'maandelijks';

export interface BronPlan {
  id: string;
  actief: boolean;
  auto_import: boolean;
  auto_verwerken: boolean;
  frequentie: Frequentie;
  /** 1=ma … 7=zo */
  dag_van_week: number | null;
  tijdstip_uur: number;
  volgende_run_op: string | null;
  laatste_sync_op: string | null;
}

/** Vaste dag-van-de-maand voor 'maandelijks' in V1. */
export const DAG_VAN_DE_MAAND = 28;

// --- Europe/Amsterdam helpers ---
interface AmsParts {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
  /** 1=ma … 7=zo */
  weekday: number;
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

export function amsterdamParts(d: Date): AmsParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'short',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== 'literal') parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_MAP[parts.weekday] ?? 1,
  };
}

/** Bouw een UTC Date die overeenkomt met de Amsterdam-wallclock y-m-d h:00. */
export function amsterdamWallToUtc(y: number, m: number, d: number, h: number): Date {
  // Eerste gok: behandel y-m-d-h als UTC, kijk hoe Amsterdam dat ziet, en corrigeer.
  const guess = new Date(Date.UTC(y, m - 1, d, h, 0, 0));
  const p = amsterdamParts(guess);
  const desiredMinutes = h * 60;
  const actualMinutes = p.hour * 60 + p.minute;
  let diff = desiredMinutes - actualMinutes;
  // Day boundary kruisen (b.v. -23h) → naar dichtstbijzijnde offset toetrekken.
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;
  return new Date(guess.getTime() + diff * 60_000);
}

/** Voeg n dagen toe aan een Amsterdam-wallclock datum. */
function plusDagen(y: number, m: number, d: number, n: number): { year: number; month: number; day: number } {
  // Gebruik UTC voor de dagboekhouding; dag-rollover is consistent.
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

interface Ymd { y: number; m: number; d: number }

function cmpYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

function parseYmd(s: string | null | undefined): Ymd | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

/** Geef Amsterdam-datum (YYYY-MM-DD) terug voor 'vandaag'. */
export function amsterdamToday(now: Date): string {
  const p = amsterdamParts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Bereken volgende_run_op voor een bron met expliciete startdatum (`auto_start_op`).
 * Retourneert `null` voor 'handmatig' of als er geen run gepland kan worden.
 */
export function berekenVolgendeRunMetStart(
  now: Date,
  frequentie: Frequentie,
  tijdstipUur: number,
  dagVanWeek: number | null,
  autoStartOp: string | null,
): Date | null {
  if (frequentie === 'handmatig') return null;
  const uur = Math.max(0, Math.min(23, Math.floor(tijdstipUur)));
  const pNow = amsterdamParts(now);
  const today: Ymd = { y: pNow.year, m: pNow.month, d: pNow.day };
  const startCand = parseYmd(autoStartOp);
  const min: Ymd = startCand && cmpYmd(startCand, today) > 0 ? startCand : today;

  if (frequentie === 'dagelijks') {
    let cand = amsterdamWallToUtc(min.y, min.m, min.d, uur);
    if (cand <= now) {
      const next = plusDagen(min.y, min.m, min.d, 1);
      cand = amsterdamWallToUtc(next.year, next.month, next.day, uur);
    }
    return cand;
  }

  if (frequentie === 'wekelijks') {
    const target = dagVanWeek && dagVanWeek >= 1 && dagVanWeek <= 7 ? dagVanWeek : 1;
    // Weekdag van min bepalen via een veilig moment (12:00 Amsterdam).
    const minMidUtc = amsterdamWallToUtc(min.y, min.m, min.d, 12);
    const minWeekday = amsterdamParts(minMidUtc).weekday;
    let daysAhead = (target - minWeekday + 7) % 7;
    let tgt: { year: number; month: number; day: number } =
      daysAhead === 0 ? { year: min.y, month: min.m, day: min.d }
                      : plusDagen(min.y, min.m, min.d, daysAhead);
    let cand = amsterdamWallToUtc(tgt.year, tgt.month, tgt.day, uur);
    if (cand <= now) {
      tgt = plusDagen(tgt.year, tgt.month, tgt.day, 7);
      cand = amsterdamWallToUtc(tgt.year, tgt.month, tgt.day, uur);
    }
    return cand;
  }

  if (frequentie === 'maandelijks') {
    let y = min.y, m = min.m;
    if (min.d > DAG_VAN_DE_MAAND) {
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    let cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur);
    if (cand <= now) {
      m += 1; if (m > 12) { m = 1; y += 1; }
      cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur);
    }
    return cand;
  }
  return null;
}

/**
 * Bepaal de eerstvolgende geplande run (UTC instant) voor een bron.
 * Retourneert `null` voor 'handmatig'.
 */
export function berekenVolgendeRun(
  now: Date,
  frequentie: Frequentie,
  tijdstipUur: number,
  dagVanWeek: number | null,
): Date | null {
  if (frequentie === 'handmatig') return null;
  const uur = Math.max(0, Math.min(23, Math.floor(tijdstipUur)));
  const p = amsterdamParts(now);

  if (frequentie === 'dagelijks') {
    const vandaag = amsterdamWallToUtc(p.year, p.month, p.day, uur);
    if (vandaag > now) return vandaag;
    const morgen = plusDagen(p.year, p.month, p.day, 1);
    return amsterdamWallToUtc(morgen.year, morgen.month, morgen.day, uur);
  }

  if (frequentie === 'wekelijks') {
    const target = dagVanWeek && dagVanWeek >= 1 && dagVanWeek <= 7 ? dagVanWeek : 1;
    let daysAhead = (target - p.weekday + 7) % 7;
    const vandaagCand = amsterdamWallToUtc(p.year, p.month, p.day, uur);
    if (daysAhead === 0 && vandaagCand <= now) daysAhead = 7;
    if (daysAhead === 0) return vandaagCand;
    const tgt = plusDagen(p.year, p.month, p.day, daysAhead);
    return amsterdamWallToUtc(tgt.year, tgt.month, tgt.day, uur);
  }

  if (frequentie === 'maandelijks') {
    // Vaste dag 28; deze dag bestaat altijd in elke maand.
    let y = p.year, m = p.month;
    let cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur);
    if (cand <= now) {
      m += 1; if (m > 12) { m = 1; y += 1; }
      cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur);
    }
    return cand;
  }
  return null;
}

/** Is een bron volgens schema aan de beurt? */
export function isAanDeBeurt(bron: BronPlan, now: Date): boolean {
  if (!bron.actief || !bron.auto_import) return false;
  if (bron.frequentie === 'handmatig') return false;
  if (bron.volgende_run_op) {
    return new Date(bron.volgende_run_op).getTime() <= now.getTime();
  }
  // Nog geen geplande tijd → eerste keer: direct uitvoeren.
  return true;
}

/** Filter + sorteer bronnen die nu mogen draaien. */
export function selecteerBronnenVoorRun<T extends BronPlan>(bronnen: T[], now: Date): T[] {
  return bronnen
    .filter(b => isAanDeBeurt(b, now))
    .sort((a, b) => {
      const av = a.volgende_run_op ? new Date(a.volgende_run_op).getTime() : 0;
      const bv = b.volgende_run_op ? new Date(b.volgende_run_op).getTime() : 0;
      return av - bv;
    });
}
