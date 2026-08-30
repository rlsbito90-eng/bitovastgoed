import { maakGepoorteProductieTransactieRepository } from './gepoorteProductieTransactieRepository';
import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import { bouwProductieRpcAanroep, type ProductieRpcNaam } from './productieRpcContract';
import {
  bevestigLeegRpcResultaat,
  normaliseerProductieRpcFout,
  parseBriefDefinitiefRpcResultaat,
  type ProductieRpcFout,
} from './productieRpcResultaat';
import type {
  AcquisitieProductieTransactieRepository,
  BriefDefinitiefResultaat,
} from './productieTransactieRepository';
import type {
  BatchDocumentenRegistrerenInput,
  BatchDocumentversieVernieuwenInput,
  BatchGeprintMarkerenInput,
  BatchGepostMarkerenInput,
  BriefDefinitiefMakenInput,
  BriefGepostMarkerenInput,
  ProductieTransactieInput,
} from './productieTransactieContract';

export interface ProductieSupabaseRpcRespons {
  data: unknown;
  error: {
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  } | null;
}

/**
 * Smalle clientgrens voor Supabase RPC. De adapter importeert bewust geen
 * globale Supabase-client en kan daardoor zelf geen verbinding openen.
 */
export interface ProductieSupabaseRpcUitvoerder {
  voerRpcUit(
    rpc: ProductieRpcNaam,
    parameters: Record<string, unknown>,
  ): Promise<ProductieSupabaseRpcRespons>;
}

export class ProductieSupabaseRpcError extends Error {
  readonly code: ProductieRpcFout['code'];
  readonly rpc: ProductieRpcNaam;
  readonly retrybaar: boolean;
  readonly technischeMelding: string | null;

  constructor(fout: ProductieRpcFout) {
    super(fout.veiligBericht);
    this.name = 'ProductieSupabaseRpcError';
    this.code = fout.code;
    this.rpc = fout.rpc;
    this.retrybaar = fout.retrybaar;
    this.technischeMelding = fout.technischeMelding;
  }
}

async function voerUit(
  uitvoerder: ProductieSupabaseRpcUitvoerder,
  input: ProductieTransactieInput,
): Promise<unknown> {
  const aanroep = bouwProductieRpcAanroep(input);
  const respons = await uitvoerder.voerRpcUit(aanroep.rpc, aanroep.parameters);

  if (respons.error) {
    throw new ProductieSupabaseRpcError(normaliseerProductieRpcFout({
      rpc: aanroep.rpc,
      message: respons.error.message,
      details: respons.error.details,
      hint: respons.error.hint,
    }));
  }

  return respons.data;
}

/**
 * Concrete persistente schrijfadapter. Iedere handeling gaat exact via één
 * allowlisted transactionele RPC; losse tabelwrites zijn hier onmogelijk.
 * Activatie wordt niet in deze klasse besloten maar door de centrale poort.
 */
export class SupabaseAcquisitieProductieTransactieRepository
implements AcquisitieProductieTransactieRepository {
  constructor(private readonly uitvoerder: ProductieSupabaseRpcUitvoerder) {}

  async maakBriefDefinitief(
    input: BriefDefinitiefMakenInput,
  ): Promise<BriefDefinitiefResultaat> {
    const data = await voerUit(this.uitvoerder, input);
    return parseBriefDefinitiefRpcResultaat(data);
  }

  async registreerBatchdocumenten(
    input: BatchDocumentenRegistrerenInput,
  ): Promise<void> {
    const data = await voerUit(this.uitvoerder, input);
    bevestigLeegRpcResultaat(data);
  }

  async vernieuwBatchdocumenten(
    input: BatchDocumentversieVernieuwenInput,
  ): Promise<void> {
    const data = await voerUit(this.uitvoerder, input);
    bevestigLeegRpcResultaat(data);
  }

  async markeerBatchGeprint(input: BatchGeprintMarkerenInput): Promise<void> {
    const data = await voerUit(this.uitvoerder, input);
    bevestigLeegRpcResultaat(data);
  }

  async markeerBatchGepost(input: BatchGepostMarkerenInput): Promise<void> {
    const data = await voerUit(this.uitvoerder, input);
    bevestigLeegRpcResultaat(data);
  }

  async markeerBriefGepost(input: BriefGepostMarkerenInput): Promise<void> {
    const data = await voerUit(this.uitvoerder, input);
    bevestigLeegRpcResultaat(data);
  }
}

/**
 * Voorkeursfactory voor applicatiecompositie. Ook met een echte RPC-uitvoerder
 * blijft schrijven standaard gesloten zolang het centrale activatiebesluit
 * niet volledig groen is.
 */
export function maakGepoorteSupabaseProductieTransactieRepository(
  activatie: ProductiekernActivatieBesluit,
  uitvoerder: ProductieSupabaseRpcUitvoerder,
): AcquisitieProductieTransactieRepository {
  return maakGepoorteProductieTransactieRepository(
    activatie,
    new SupabaseAcquisitieProductieTransactieRepository(uitvoerder),
  );
}
