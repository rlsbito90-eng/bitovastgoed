import { supabase } from '@/integrations/supabase/client';

import {
  maakBestaandConceptBridgeSupabaseRepository,
  type BestaandConceptBridgeRepository,
  type BestaandConceptBridgeRpcUitvoerder,
} from './bestaandConceptBridgeSupabaseRepository';
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
  bestaandConceptBridgeRepository: BestaandConceptBridgeRepository;
  transactieRepository: AcquisitieProductieTransactieRepository;
}

export interface ProductiekernBrowserWriteUitvoerders {
  vroege: VroegeRpcUitvoerder;
  bestaandConceptBridge: BestaandConceptBridgeRpcUitvoerder;
  transacties: ProductieSupabaseRpcUitvoerder;
}

/**
 * Bouwt de browser-writekant uitsluitend bovenop één reeds fail-closed
 * werk-CRM-activatiebesluit. Alle repository-adapters behouden hun eigen
 * `schrijvenActief`-controle; deze compositie voegt geen alternatieve
 * featureflag of bypass toe.
 *
 * De bestaand-concept-bridge is hier alleen technisch samengesteld. Zolang
 * geen UI die repository aanroept, en zolang de databasefunctie niet apart is
 * geïnstalleerd/gegrant, ontstaat er geen operationeel bridgepad.
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
    bestaandConceptBridgeRepository: maakBestaandConceptBridgeSupabaseRepository({
      activatie,
      uitvoerder: uitvoerders.bestaandConceptBridge,
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

async function voerBrowserRpcUit(naam: string, parameters: Record<string, unknown>) {
  const respons = await rpcClient.rpc(naam, parameters);
  return {
    data: respons.data,
    error: respons.error
      ? { message: respons.error.message ?? undefined, code: respons.error.code ?? undefined }
      : null,
  };
}

const browserUitvoerders: ProductiekernBrowserWriteUitvoerders = {
  vroege: {
    rpc: voerBrowserRpcUit,
  },
  bestaandConceptBridge: {
    rpc: voerBrowserRpcUit,
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
 * alle expliciete werk-CRM-envbewijzen leveren alle repositories uitsluitend
 * fail-closed schrijfgedrag op.
 */
export function maakStandaardProductiekernBrowserWriteSamenstelling(): ProductiekernBrowserWriteSamenstelling {
  return stelProductiekernBrowserWritesSamen(
    import.meta.env as ProductiekernBrowserOmgeving,
    browserUitvoerders,
  );
}
