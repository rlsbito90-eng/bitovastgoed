// Vertaalt ruwe database/Postgres-foutmeldingen naar veilige, generieke
// Nederlandse berichten. Voorkomt dat interne schema-details (tabel-,
// kolom- of constraintnamen) lekken via toast-meldingen.

type AnyErr = { message?: string; code?: string; details?: string } | null | undefined;

const CODE_MAP: Record<string, string> = {
  '23505': 'Deze waarde bestaat al.',
  '23502': 'Een verplicht veld ontbreekt.',
  '23503': 'Gerelateerd record ontbreekt of is in gebruik.',
  '23514': 'Waarde voldoet niet aan de regels.',
  '42501': 'Geen rechten voor deze actie.',
  '42P01': 'Onderdeel niet beschikbaar.',
  'PGRST301': 'Geen rechten voor deze actie.',
  '22P02': 'Ongeldig invoerformaat.',
};

/**
 * Map een (Supabase/Postgres) fout naar een veilig Nederlands bericht.
 * Logt het ruwe object naar de console voor debugging.
 */
export function mapDbError(error: AnyErr, fallback = 'Er ging iets mis. Probeer het opnieuw.'): string {
  if (!error) return fallback;
  // Altijd ruwe details naar console voor dev/debug
  // eslint-disable-next-line no-console
  console.error('[db error]', error);

  const code = (error as any).code as string | undefined;
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('duplicate')) return CODE_MAP['23505'];
  if (msg.includes('permission denied') || msg.includes('row-level security')) return CODE_MAP['42501'];
  if (msg.includes('violates not-null')) return CODE_MAP['23502'];
  if (msg.includes('foreign key')) return CODE_MAP['23503'];
  if (msg.includes('invalid input')) return CODE_MAP['22P02'];

  return fallback;
}
