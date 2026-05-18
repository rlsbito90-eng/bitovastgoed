import type { Taak, TaakStatus } from '@/data/mock-data';

/**
 * Combineer deadline (YYYY-MM-DD) en deadline_tijd (HH:MM[:SS]) tot
 * een lokale Date. Geen tijd → einde van die dag (23:59:59.999) zodat
 * de taak gedurende de hele dag niet als te laat geldt.
 */
export function getDeadlineDateTime(taak: Pick<Taak, 'deadline' | 'deadlineTijd'>): Date | null {
  if (!taak.deadline) return null;
  const [y, m, d] = taak.deadline.split('-').map(Number);
  if (!y || !m || !d) return null;
  if (taak.deadlineTijd) {
    const [hh = 0, mm = 0] = taak.deadlineTijd.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Een taak is alleen "te laat" als deadline echt verstreken is en taak nog open/wacht is. */
export function isTaakTeLaat(taak: Pick<Taak, 'deadline' | 'deadlineTijd' | 'status'>, now: Date = new Date()): boolean {
  if (taak.status === 'afgerond' || taak.status === 'geannuleerd') return false;
  const dt = getDeadlineDateTime(taak);
  if (!dt) return false;
  return dt.getTime() < now.getTime();
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

export function isTaakVandaag(taak: Pick<Taak, 'deadline'>, now: Date = new Date()): boolean {
  if (!taak.deadline) return false;
  const [y, m, d] = taak.deadline.split('-').map(Number);
  if (!y) return false;
  const s = startOfDay(now);
  return s.getFullYear() === y && (s.getMonth() + 1) === m && s.getDate() === d;
}

export function isTaakDezeWeek(taak: Pick<Taak, 'deadline'>, now: Date = new Date()): boolean {
  if (!taak.deadline) return false;
  const [y, m, d] = taak.deadline.split('-').map(Number);
  if (!y) return false;
  const start = startOfDay(now).getTime();
  const eind = start + 7 * 24 * 60 * 60 * 1000;
  const t = new Date(y, m - 1, d).getTime();
  return t >= start && t <= eind;
}

/** Slim label voor deadline (Vandaag · 16:00, Morgen, datum). */
export function deadlineLabel(taak: Pick<Taak, 'deadline' | 'deadlineTijd'>, now: Date = new Date()): string {
  if (!taak.deadline) return 'Geen datum';
  const [y, m, d] = taak.deadline.split('-').map(Number);
  if (!y) return 'Geen datum';
  const day = new Date(y, m - 1, d);
  const today = startOfDay(now);
  const diff = Math.round((day.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  let datumLabel: string;
  if (diff === 0) datumLabel = 'Vandaag';
  else if (diff === 1) datumLabel = 'Morgen';
  else if (diff === -1) datumLabel = 'Gisteren';
  else datumLabel = day.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: day.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  return taak.deadlineTijd ? `${datumLabel} · ${taak.deadlineTijd.slice(0, 5)}` : datumLabel;
}

const prioWeight: Record<string, number> = { urgent: 0, hoog: 1, normaal: 2, laag: 3 };

/** Sorteer: te laat eerst, daarna vandaag, daarna komende, daarna zonder datum. Binnen groep prioriteit. */
export function sorteerTaken(taken: Taak[], now: Date = new Date()): Taak[] {
  return [...taken].sort((a, b) => {
    const aLaat = isTaakTeLaat(a, now);
    const bLaat = isTaakTeLaat(b, now);
    if (aLaat !== bLaat) return aLaat ? -1 : 1;
    const aHasDate = !!a.deadline;
    const bHasDate = !!b.deadline;
    if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
    if (aHasDate && bHasDate) {
      const ta = getDeadlineDateTime(a)!.getTime();
      const tb = getDeadlineDateTime(b)!.getTime();
      if (ta !== tb) return ta - tb;
    }
    return (prioWeight[a.prioriteit] ?? 9) - (prioWeight[b.prioriteit] ?? 9);
  });
}

export const TAAK_TYPES = [
  'Bellen',
  'E-mailen',
  'WhatsApp',
  'LinkedIn',
  'Follow-up',
  'Bezichtiging plannen',
  'Documenten opvragen',
  'Bieding opvolgen',
  'NDA opvolgen',
  'Analyse maken',
  'Algemeen',
] as const;

export const TAAK_STATUSES: { value: TaakStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'wacht_op_reactie', label: 'Wachten op reactie' },
  { value: 'in_uitvoering', label: 'In uitvoering' },
  { value: 'afgerond', label: 'Afgerond' },
  { value: 'geannuleerd', label: 'Geannuleerd' },
];
