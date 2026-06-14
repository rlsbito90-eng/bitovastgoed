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
  tijdstip_minuut?: number;
  volgende_run_op: string | null;
  laatste_sync_op: string | null;
}

/** Vaste dag-van-de-maand voor 'maandelijks' in V1. */
export const DAG_VAN_DE_MAAND = 28;
/** Toegestane minuten voor planning. */
export const TOEGESTANE_MINUTEN = [0, 15, 30, 45] as const;
export type ToegestaneMinuut = typeof TOEGESTANE_MINUTEN[number];

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

/** Bouw een UTC Date die overeenkomt met de Amsterdam-wallclock y-m-d h:mm. */
export function amsterdamWallToUtc(y: number, m: number, d: number, h: number, min = 0): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min, 0));
  const p = amsterdamParts(guess);
  const desiredMinutes = h * 60 + min;
  const actualMinutes = p.hour * 60 + p.minute;
  let diff = desiredMinutes - actualMinutes;
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;
  return new Date(guess.getTime() + diff * 60_000);
}

/** Voeg n dagen toe aan een Amsterdam-wallclock datum. */
function plusDagen(y: number, m: number, d: number, n: number): { year: number; month: number; day: number } {
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

/** Normaliseer minuut-waarde naar 0/15/30/45. */
export function normaliseerMinuut(v: unknown): ToegestaneMinuut {
  const n = Math.floor(Number(v ?? 0));
  return (TOEGESTANE_MINUTEN as readonly number[]).includes(n) ? (n as ToegestaneMinuut) : 0;
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
  tijdstipMinuut: number = 0,
): Date | null {
  if (frequentie === 'handmatig') return null;
  const uur = Math.max(0, Math.min(23, Math.floor(tijdstipUur)));
  const min = normaliseerMinuut(tijdstipMinuut);
  const pNow = amsterdamParts(now);
  const today: Ymd = { y: pNow.year, m: pNow.month, d: pNow.day };
  const startCand = parseYmd(autoStartOp);
  const minDate: Ymd = startCand && cmpYmd(startCand, today) > 0 ? startCand : today;

  if (frequentie === 'dagelijks') {
    let cand = amsterdamWallToUtc(minDate.y, minDate.m, minDate.d, uur, min);
    if (cand <= now) {
      const next = plusDagen(minDate.y, minDate.m, minDate.d, 1);
      cand = amsterdamWallToUtc(next.year, next.month, next.day, uur, min);
    }
    return cand;
  }

  if (frequentie === 'wekelijks') {
    const target = dagVanWeek && dagVanWeek >= 1 && dagVanWeek <= 7 ? dagVanWeek : 1;
    const minMidUtc = amsterdamWallToUtc(minDate.y, minDate.m, minDate.d, 12);
    const minWeekday = amsterdamParts(minMidUtc).weekday;
    const daysAhead = (target - minWeekday + 7) % 7;
    let tgt: { year: number; month: number; day: number } =
      daysAhead === 0 ? { year: minDate.y, month: minDate.m, day: minDate.d }
                      : plusDagen(minDate.y, minDate.m, minDate.d, daysAhead);
    let cand = amsterdamWallToUtc(tgt.year, tgt.month, tgt.day, uur, min);
    if (cand <= now) {
      tgt = plusDagen(tgt.year, tgt.month, tgt.day, 7);
      cand = amsterdamWallToUtc(tgt.year, tgt.month, tgt.day, uur, min);
    }
    return cand;
  }

  if (frequentie === 'maandelijks') {
    let y = minDate.y, m = minDate.m;
    if (minDate.d > DAG_VAN_DE_MAAND) {
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    let cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur, min);
    if (cand <= now) {
      m += 1; if (m > 12) { m = 1; y += 1; }
      cand = amsterdamWallToUtc(y, m, DAG_VAN_DE_MAAND, uur, min);
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
  tijdstipMinuut: number = 0,
): Date | null {
  return berekenVolgendeRunMetStart(now, frequentie, tijdstipUur, dagVanWeek, null, tijdstipMinuut);
}

/** Is een bron volgens schema aan de beurt? */
export function isAanDeBeurt(bron: BronPlan, now: Date): boolean {
  if (!bron.actief || !bron.auto_import) return false;
  if (bron.frequentie === 'handmatig') return false;
  if (bron.volgende_run_op) {
    return new Date(bron.volgende_run_op).getTime() <= now.getTime();
  }
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
