import { supabase } from '@/integrations/supabase/client';

import type {
  ProductiekernSupabaseClientLike,
  ProductiekernSupabaseQueryBuilder,
} from './productiekernSupabaseQueryUitvoerder';
import {
  stelProductiekernBrowserLezenSamen,
  stelProductiekernBrowserLezenSamenMetBesluit,
} from './productiekernBrowserLeesSamenstelling';
import { bepaalWerkCrmActivatie } from './werkCrmActivatiePoort';
import { bouwWerkCrmActivatieBewijs } from './werkCrmOmgevingsBewijs';

/**
 * Smalle adapter rond de reeds bestaande CRM-Supabase-client.
 *
 * De nieuwe productiekern importeert daardoor geen eigen URL/key/client en kan
 * niet per ongeluk naar een andere Supabase-omgeving wijzen. De casts zijn
 * uitsluitend nodig omdat de nog niet gemigreerde productiekern-tabellen nog
 * niet in de gegenereerde Database-types voorkomen.
 */
export const productiekernBrowserSupabaseClient: ProductiekernSupabaseClientLike = {
  from(tabel: string) {
    return supabase.from(tabel as never) as unknown as ProductiekernSupabaseQueryBuilder;
  },
};

function viteOmgeving() {
  return import.meta.env as Record<string, string | boolean | undefined>;
}

/**
 * Bouwt uitsluitend uit expliciete Vite/Vercel-configuratie een werk-CRM-
 * activatiebesluit. Een previewhostname, branchnaam of Vercel-context opent
 * niets automatisch. De daadwerkelijke VITE_SUPABASE_URL moet exact bij de
 * apart ingestelde verwachte projectref horen.
 */
export function bepaalBrowserWerkCrmActivatie() {
  const env = viteOmgeving();
  const bewijs = bouwWerkCrmActivatieBewijs({
    modus: env.VITE_ACQUISITIE_PRODUCTIEKERN_MODUS as string | undefined,
    actueleSupabaseUrl: env.VITE_SUPABASE_URL as string | undefined,
    verwachteSupabaseProjectref:
      env.VITE_ACQUISITIE_PRODUCTIEKERN_WERKCRM_PROJECTREF as string | undefined,
    schemaGeinstalleerd:
      env.VITE_ACQUISITIE_PRODUCTIEKERN_SCHEMA_GEINSTALLEERD as string | undefined,
    rlsEnRechtenGeverifieerd:
      env.VITE_ACQUISITIE_PRODUCTIEKERN_RLS_GEVERIFIEERD as string | undefined,
    gerichteWorkflowtestsGroen:
      env.VITE_ACQUISITIE_PRODUCTIEKERN_WORKFLOWTESTS_GROEN as string | undefined,
    applicatiebuildGroen:
      env.VITE_ACQUISITIE_PRODUCTIEKERN_BUILD_GROEN as string | undefined,
    duurzameDatabewaringBevestigd:
      env.VITE_ACQUISITIE_PRODUCTIEKERN_DUURZAME_DATA as string | undefined,
    explicietWerkakkoord:
      env.VITE_ACQUISITIE_PRODUCTIEKERN_WERKAKKOORD as string | undefined,
  });

  return bepaalWerkCrmActivatie(bewijs);
}

/**
 * Huidige applicatiesamenstelling.
 *
 * Alleen de expliciete werk-CRM-modus kan via de afzonderlijke werk-CRM-poort
 * lezen vrijgeven. Iedere andere modus valt bewust terug op de bestaande
 * productie-readroute met undefined bewijs en blijft dus volledig gesloten.
 */
export function maakStandaardProductiekernBrowserLeesSamenstelling() {
  const env = viteOmgeving();
  if (env.VITE_ACQUISITIE_PRODUCTIEKERN_MODUS === 'werkcrm') {
    return stelProductiekernBrowserLezenSamenMetBesluit(
      productiekernBrowserSupabaseClient,
      bepaalBrowserWerkCrmActivatie(),
    );
  }

  return stelProductiekernBrowserLezenSamen(
    productiekernBrowserSupabaseClient,
    undefined,
  );
}
