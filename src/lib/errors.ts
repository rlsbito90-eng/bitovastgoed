// Centrale foutafhandeling voor de app.
// Vertaalt Supabase/Postgres-errors naar concrete Nederlandse meldingen,
// inclusief module-, sectie- en recordcontext waar beschikbaar.
//
// Gebruik:
//   showAppErrorToast(error, { module: 'Vastgoedrekenen', section: 'Componentstrategie', record: 'Woning 92A' });
//   const msg = describeDbError(error, { module: 'Relaties', field: 'Bedrijfsnaam' });

import { toast } from 'sonner';

export type ErrorContext = {
  /** Bv. "Vastgoedrekenen", "Relaties", "Objecten". */
  module?: string;
  /** Bv. "Componentstrategie", "WWS", "Aankoopanalyse". */
  section?: string;
  /** Bv. "Woning 92A". */
  record?: string;
  /** Menselijke veldnaam, bv. "Vraagprijs". */
  field?: string;
  /** Technische kolom in DB, bv. "asking_price". */
  column?: string;
  /** Wat de gebruiker moet doen om het op te lossen. */
  action?: string;
  /** Vrije fallbacktekst als geen specifieke vertaling beschikbaar is. */
  fallback?: string;
};

type AnyErr = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null | undefined;

const CODE_BASE: Record<string, string> = {
  '23502': 'Verplicht veld ontbreekt',
  '23503': 'Gerelateerd record ontbreekt of is in gebruik',
  '23505': 'Deze waarde bestaat al',
  '23514': 'De gekozen waarde is niet toegestaan',
  '22P02': 'Ongeldig invoerformaat',
  '42501': 'Je hebt geen rechten om deze wijziging op te slaan',
  '42P01': 'Onderdeel niet beschikbaar',
  'PGRST301': 'Je hebt geen rechten om deze wijziging op te slaan',
};

/** Haal kolomnaam uit een Postgres-foutmelding (bv. null value in column "scenario_id"). */
function extractColumn(err: AnyErr): string | undefined {
  const msg = `${err?.message ?? ''} ${err?.details ?? ''}`;
  const m = msg.match(/column "([^"]+)"/i) || msg.match(/Key \(([^)]+)\)=/i);
  return m?.[1];
}

function extractConstraint(err: AnyErr): string | undefined {
  const msg = `${err?.message ?? ''} ${err?.details ?? ''}`;
  const m = msg.match(/constraint "([^"]+)"/i);
  return m?.[1];
}

/** Bouw een prefix als "Module › Sectie › Record". */
function buildPrefix(ctx?: ErrorContext): string {
  if (!ctx) return '';
  const parts = [ctx.module, ctx.section, ctx.record].filter(Boolean);
  return parts.length ? `${parts.join(' › ')}: ` : '';
}

/** Geef een concrete melding voor een ontbrekend verplicht veld. */
export function getRequiredFieldMessage(field: string, ctx?: ErrorContext): string {
  return `${buildPrefix(ctx)}${field} is verplicht.`;
}

export function getEnumConstraintMessage(field: string, value: unknown, ctx?: ErrorContext): string {
  return `${buildPrefix(ctx)}waarde '${String(value)}' is niet toegestaan voor ${field}.`;
}

export function getForeignKeyErrorMessage(field: string | undefined, ctx?: ErrorContext): string {
  const f = field ? ` (${field})` : '';
  return `${buildPrefix(ctx)}deze regel verwijst naar een niet-bestaand record${f}.`;
}

export function getUniqueConstraintMessage(field: string | undefined, ctx?: ErrorContext): string {
  const f = field ? ` voor ${field}` : '';
  return `${buildPrefix(ctx)}deze waarde bestaat al${f}.`;
}

/** Parse een Supabase/Postgres-error en geef code + leesbare basis terug. */
export function parseSupabaseError(error: AnyErr): {
  code?: string;
  column?: string;
  constraint?: string;
  base: string;
  raw: string;
} {
  const code = (error as { code?: string } | null | undefined)?.code;
  const column = extractColumn(error);
  const constraint = extractConstraint(error);
  const base = (code && CODE_BASE[code]) || inferFromMessage(error) || 'Onbekende databasefout';
  const raw = [error?.message, error?.details, error?.hint].filter(Boolean).join(' | ');
  return { code, column, constraint, base, raw };
}

function inferFromMessage(error: AnyErr): string | undefined {
  const msg = (error?.message ?? '').toLowerCase();
  if (!msg) return undefined;
  if (msg.includes('duplicate')) return CODE_BASE['23505'];
  if (msg.includes('permission denied') || msg.includes('row-level security')) return CODE_BASE['42501'];
  if (msg.includes('violates not-null') || msg.includes('not-null')) return CODE_BASE['23502'];
  if (msg.includes('foreign key')) return CODE_BASE['23503'];
  if (msg.includes('check constraint')) return CODE_BASE['23514'];
  if (msg.includes('invalid input')) return CODE_BASE['22P02'];
  return undefined;
}

/** Volledige beschrijving van een DB-fout met context. */
export function describeDbError(error: AnyErr, ctx?: ErrorContext): string {
  if (!error) return ctx?.fallback ?? 'Er ging iets mis. Probeer het opnieuw.';
  // eslint-disable-next-line no-console
  console.error('[db error]', error, ctx);
  const { code, column, base } = parseSupabaseError(error);
  const prefix = buildPrefix(ctx);
  const fieldLabel = ctx?.field ?? column;
  let body = base;
  if (code === '23502' && fieldLabel) body = `veld '${fieldLabel}' ontbreekt`;
  else if (code === '23503' && fieldLabel) body = `koppeling op '${fieldLabel}' verwijst naar een niet-bestaand record`;
  else if (code === '23505' && fieldLabel) body = `'${fieldLabel}' bestaat al`;
  else if (code === '23514' && fieldLabel) body = `waarde voor '${fieldLabel}' is niet toegestaan`;
  else if (fieldLabel) body = `${base} (${fieldLabel})`;
  const action = ctx?.action ? ` ${ctx.action}` : '';
  return `${prefix}${body}.${action}`.trim();
}

/** Toon een toast met een concrete app-foutmelding. */
export function showAppErrorToast(error: AnyErr, ctx?: ErrorContext): void {
  toast.error(describeDbError(error, ctx));
}

/**
 * Backwards-compatible map (bestaande oproepen): vertaal een DB-fout naar string.
 * Nieuwe code: gebruik describeDbError / showAppErrorToast met context.
 */
export function mapDbError(error: AnyErr, fallback = 'Er ging iets mis. Probeer het opnieuw.'): string {
  if (!error) return fallback;
  return describeDbError(error, { fallback });
}

/** Validatie helper: maak een leesbare samenvatting van een lijst velden. */
export function formatValidationError(items: Array<{ record?: string; field: string; message?: string }>, ctx?: ErrorContext): string {
  if (items.length === 0) return '';
  const prefix = buildPrefix(ctx);
  if (items.length === 1) {
    const it = items[0];
    const where = it.record ? `${it.record}: ` : '';
    return `${prefix}${where}${it.message ?? `${it.field} ontbreekt`}.`;
  }
  const lines = items.slice(0, 5).map((it) => `• ${it.record ? `${it.record} – ` : ''}${it.message ?? `${it.field} ontbreekt`}`);
  const more = items.length > 5 ? `\n…en ${items.length - 5} meer` : '';
  return `${prefix}er zijn ${items.length} velden die gecontroleerd moeten worden:\n${lines.join('\n')}${more}`;
}
