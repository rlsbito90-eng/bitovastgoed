import { supabase } from '@/integrations/supabase/client';

import type {
  ProductiekernSupabaseClientLike,
  ProductiekernSupabaseQueryBuilder,
} from './productiekernSupabaseQueryUitvoerder';
import {
  stelProductiekernBrowserLezenSamen,
  stelProductiekernBrowserLezenSamenMetBesluit,
} from './productiekernBrowserLeesSamenstelling';
import type { ProductiekernSupabaseClientOpties } from './productiekernSupabaseClientSamenstelling';
import { bepaalProductieActivatie } from './productieActivatiePoort';
import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import { bepaalWerkCrmActivatie } from './werkCrmActivatiePoort';
import {
  bouwWerkCrmActivatieBewijs,
  haalSupabaseProjectrefUitUrl,
} from './werkCrmOmgevingsBewijs';

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

export type ProductiekernBrowserOmgeving = Record<string, string | boolean | undefined>;

function viteOmgeving(): ProductiekernBrowserOmgeving {
  return import.meta.env as ProductiekernBrowserOmgeving;
}

function isExplicietWaar(waarde: string | boolean | undefined): boolean {
  return waarde === true || waarde === 'true';
}

/**
 * Bestaande, afzonderlijke werk-CRM-poort. Deze blijft ongewijzigd bruikbaar
 * voor een duurzame werkdatabase en wordt nooit gebruikt om productie te
 * vermommen als `werkcrm`.
 */
export function bepaalBrowserWerkCrmActivatieUitOmgeving(
  env: ProductiekernBrowserOmgeving,
) {
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
 * Browservertaling voor de reeds bestaande productie-releasepoort.
 *
 * Naast de zeven inhoudelijke productiebewijzen geldt hier een harde
 * omgevingsgrens: modus moet `productie` zijn en VITE_SUPABASE_URL moet exact
 * dezelfde projectref bevatten als de afzonderlijk ingestelde verwachte
 * productieprojectref. Een preview/branch/hostname opent de poort nooit.
 */
export function bepaalBrowserProductieActivatieUitOmgeving(
  env: ProductiekernBrowserOmgeving,
): ProductiekernActivatieBesluit {
  const actueleProjectref = haalSupabaseProjectrefUitUrl(
    env.VITE_SUPABASE_URL as string | undefined,
  );
  const verwachteProjectref = (
    env.VITE_ACQUISITIE_PRODUCTIEKERN_PRODUCTIE_PROJECTREF as string | undefined
  )?.trim().toLowerCase() || null;

  const modusGroen = env.VITE_ACQUISITIE_PRODUCTIEKERN_MODUS === 'productie';
  const doelGroen = Boolean(
    actueleProjectref
    && verwachteProjectref
    && actueleProjectref === verwachteProjectref,
  );

  if (!modusGroen || !doelGroen) {
    return {
      lezenActief: false,
      schrijvenActief: false,
      ontbrekendBewijs: [
        ...(!modusGroen ? ['De doelomgeving is niet expliciet als productie gemarkeerd.'] : []),
        ...(!doelGroen ? ['De gekoppelde Supabase-omgeving komt niet overeen met het verwachte productiedoel.'] : []),
      ],
    };
  }

  return bepaalProductieActivatie({
    actueleDdlGeverifieerd: isExplicietWaar(
      env.VITE_ACQUISITIE_PRODUCTIEKERN_DDL_GEVERIFIEERD,
    ),
    actueleRlsGeverifieerd: isExplicietWaar(
      env.VITE_ACQUISITIE_PRODUCTIEKERN_RLS_GEVERIFIEERD,
    ),
    geisoleerdeMigratieproefGroen: isExplicietWaar(
      env.VITE_ACQUISITIE_PRODUCTIEKERN_MIGRATIEPROEF_GROEN,
    ),
    concurrencyproefGroen: isExplicietWaar(
      env.VITE_ACQUISITIE_PRODUCTIEKERN_CONCURRENCYPROEF_GROEN,
    ),
    volledigeTestsuiteGroen: isExplicietWaar(
      env.VITE_ACQUISITIE_PRODUCTIEKERN_VOLLEDIGE_TESTSUITE_GROEN,
    ),
    productiebuildGroen: isExplicietWaar(
      env.VITE_ACQUISITIE_PRODUCTIEKERN_BUILD_GROEN,
    ),
    explicietProductieakkoord: isExplicietWaar(
      env.VITE_ACQUISITIE_PRODUCTIEKERN_PRODUCTIEAKKOORD,
    ),
  });
}

/**
 * Enige browserdispatch voor runtime-activatie. Onbekende of ontbrekende modus
 * blijft fail-closed via de standaard productiekern-readroute.
 */
export function bepaalBrowserProductiekernActivatieUitOmgeving(
  env: ProductiekernBrowserOmgeving,
): ProductiekernActivatieBesluit {
  if (env.VITE_ACQUISITIE_PRODUCTIEKERN_MODUS === 'werkcrm') {
    return bepaalBrowserWerkCrmActivatieUitOmgeving(env);
  }
  if (env.VITE_ACQUISITIE_PRODUCTIEKERN_MODUS === 'productie') {
    return bepaalBrowserProductieActivatieUitOmgeving(env);
  }
  return {
    lezenActief: false,
    schrijvenActief: false,
    ontbrekendBewijs: ['Geen geldige Acquisitieproductiekern-runtimeomgeving geconfigureerd.'],
  };
}

export function bepaalBrowserWerkCrmActivatie() {
  return bepaalBrowserWerkCrmActivatieUitOmgeving(viteOmgeving());
}

/**
 * Huidige applicatiesamenstelling. Werk-CRM en productie hebben elk hun eigen
 * bewijsroute; alle andere configuraties blijven volledig gesloten.
 *
 * Een workflow mag uitsluitend binnen de bestaande harde bovengrens een eigen
 * readbudget kiezen. Daarmee kan een grotere, expliciet begrensde BAT-herstelread
 * meer dan de generieke 25 queries gebruiken zonder de globale fail-closed
 * budgetbewaking uit te schakelen.
 */
export function maakStandaardProductiekernBrowserLeesSamenstelling(
  opties: ProductiekernSupabaseClientOpties = {},
) {
  const env = viteOmgeving();
  const activatie = bepaalBrowserProductiekernActivatieUitOmgeving(env);

  if (activatie.lezenActief) {
    return stelProductiekernBrowserLezenSamenMetBesluit(
      productiekernBrowserSupabaseClient,
      activatie,
      opties,
    );
  }

  return stelProductiekernBrowserLezenSamen(
    productiekernBrowserSupabaseClient,
    undefined,
    opties,
  );
}
