import type { WerkCrmActivatieBewijs } from './werkCrmActivatiePoort';

export interface WerkCrmOmgevingsConfiguratie {
  modus?: string | null;
  actueleSupabaseUrl?: string | null;
  verwachteSupabaseProjectref?: string | null;
  schemaGeinstalleerd?: string | boolean | null;
  rlsEnRechtenGeverifieerd?: string | boolean | null;
  gerichteWorkflowtestsGroen?: string | boolean | null;
  applicatiebuildGroen?: string | boolean | null;
  duurzameDatabewaringBevestigd?: string | boolean | null;
  explicietWerkakkoord?: string | boolean | null;
}

function isExplicietWaar(waarde: string | boolean | null | undefined): boolean {
  return waarde === true || waarde === 'true';
}

export function haalSupabaseProjectrefUitUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Bouwt uitsluitend bewijs uit expliciete werk-CRM-configuratie.
 *
 * Geen Vercel-/previewdetectie, branchnaam of hostname van de frontend kan de
 * poort openen. Het Supabase-doel moet bovendien exact overeenkomen met de
 * apart geconfigureerde verwachte projectref. De projectref staat bewust niet
 * hardcoded in de applicatiecode.
 */
export function bouwWerkCrmActivatieBewijs(
  configuratie: WerkCrmOmgevingsConfiguratie,
): WerkCrmActivatieBewijs {
  const actueleProjectref = haalSupabaseProjectrefUitUrl(configuratie.actueleSupabaseUrl);
  const verwachteProjectref = configuratie.verwachteSupabaseProjectref?.trim().toLowerCase() || null;

  return {
    doelomgevingIsWerkdatabase: configuratie.modus === 'werkcrm',
    supabaseDoelKomtOvereen: Boolean(
      actueleProjectref
      && verwachteProjectref
      && actueleProjectref === verwachteProjectref,
    ),
    schemaGeinstalleerd: isExplicietWaar(configuratie.schemaGeinstalleerd),
    rlsEnRechtenGeverifieerd: isExplicietWaar(configuratie.rlsEnRechtenGeverifieerd),
    gerichteWorkflowtestsGroen: isExplicietWaar(configuratie.gerichteWorkflowtestsGroen),
    applicatiebuildGroen: isExplicietWaar(configuratie.applicatiebuildGroen),
    duurzameDatabewaringBevestigd: isExplicietWaar(configuratie.duurzameDatabewaringBevestigd),
    explicietWerkakkoord: isExplicietWaar(configuratie.explicietWerkakkoord),
  };
}
