import { supabase } from '@/integrations/supabase/client';

import {
  bepaalBrowserWerkCrmActivatieUitOmgeving,
  type ProductiekernBrowserOmgeving,
} from './productiekernBrowserClient';
import {
  maakGepoorteSupabaseProductieTransactieRepository,
  type ProductieSupabaseRpcUitvoerder,
} from './productieSupabaseTransactieRepository';
import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import type { AcquisitieProductieTransactieRepository } from './productieTransactieRepository';
import {
  maakVroegeProductieSupabaseRepository,
  type VroegeProductieWriteRepository,
  type VroegeRpcUitvoerder,
} from './vroegeProductieSupabaseRepository';

export interface ProductiekernBrowserWriteSamenstelling {
  activatie: ProductiekernActivatieBesluit;
  vroegeRepository: VroegeProductieWriteRepository;
  transactieRepository: AcquisitieProductieTransactieRepository;
}

export interface ProductiekernBrowserWriteUitvoerders {
  vroege: VroegeRpcUitvoerder;
  transacties: ProductieSupabaseRpcUitvoerder;
}

/**
 * Bouwt de browser-writekant uitsluitend bovenop een reeds fail-closed
 * werk-CRM-activatiebesluit. Beide bestaande repository-adapters blijven hun
 * eigen `schrijvenActief`-controle uitvoeren; deze compositie voegt dus geen
 * alternatieve featureflag of bypass toe.
 */
export function stelProductiekernBrowserWritesSamen(
  env: ProductiekernBrowserOmgeving,
  uitvoerders: ProductiekernBrowserWriteUitvoerders,
): ProductiekernBrowserWriteSamenstelling {
  const activatie = bepaalBrowserWerkCrmActivatieUitOmgeving(env);

  return {
    activatie,
    vroegeRepository: maakVroegeProductieSupabaseRepository({
      activatie,
      uitvoerder: uitvoerders.vroege,
    }),
    transactieRepository: maakGepoorteSupabaseProductieTransactieRepository(
      activatie,
      uitvoerders.transacties,
    ),
  };
}

type SupabaseRpcClient = {
  rpc(
    naam: string,
    parameters: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string | null; details?: string | null; hint?: string | null; code?: string | null } | null }>;
};

const rpcClient = supabase as unknown as SupabaseRpcClient;

const browserUitvoerders: ProductiekernBrowserWriteUitvoerders = {
  vroege: {
    async rpc(naam, parameters) {
      const respons = await rpcClient.rpc(naam, parameters);
      return {
        data: respons.data,
        error: respons.error
          ? { message: respons.error.message ?? undefined, code: respons.error.code ?? undefined }
          : null,
      };
    },
  },
  transacties: {
    async voerRpcUit(rpc, parameters) {
      const respons = await rpcClient.rpc(rpc, parameters);
      return {
        data: respons.data,
        error: respons.error
          ? {
            message: respons.error.message,
            details: respons.error.details,
            hint: respons.error.hint,
          }
          : null,
      };
    },
  },
};

/**
 * Standaard browsercompositie. Er wordt niets automatisch geactiveerd: zonder
 * alle expliciete werk-CRM-envbewijzen leveren beide repositories uitsluitend
 * fail-closed schrijfgedrag op.
 */
export function maakStandaardProductiekernBrowserWriteSamenstelling(): ProductiekernBrowserWriteSamenstelling {
  return stelProductiekernBrowserWritesSamen(
    import.meta.env as ProductiekernBrowserOmgeving,
    browserUitvoerders,
  );
}
