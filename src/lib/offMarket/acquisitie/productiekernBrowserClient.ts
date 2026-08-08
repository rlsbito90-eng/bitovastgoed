import { supabase } from '@/integrations/supabase/client';

import type {
  ProductiekernSupabaseClientLike,
  ProductiekernSupabaseQueryBuilder,
} from './productiekernSupabaseQueryUitvoerder';
import { stelProductiekernBrowserLezenSamen } from './productiekernBrowserLeesSamenstelling';

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

/**
 * Huidige applicatiesamenstelling: fysiek gekoppeld aan de bestaande client,
 * maar bewijs bewust undefined. De centrale leespoort blijft dus dicht en geen
 * enkele repository-read bereikt client.from().
 */
export function maakStandaardProductiekernBrowserLeesSamenstelling() {
  return stelProductiekernBrowserLezenSamen(
    productiekernBrowserSupabaseClient,
    undefined,
  );
}
