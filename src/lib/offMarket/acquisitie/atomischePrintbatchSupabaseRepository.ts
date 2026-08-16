import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';
import type { PrintbatchContract } from './productiekernContract';

export interface AtomischePrintbatchRpcUitvoerder {
  rpc<T = unknown>(
    naam: string,
    parameters: Record<string, unknown>,
  ): Promise<{
    data: T | null;
    error: { message?: string; code?: string } | null;
  }>;
}

export interface AtomischePrintbatchBriefRef {
  briefId: string;
  briefVersieId: string;
}

export interface AtomischePrintbatchRepository {
  maakPrintbatchMetBrieven(input: {
    actorId: string;
    operationKey: string;
    datum: string;
    brieven: readonly AtomischePrintbatchBriefRef[];
  }): Promise<PrintbatchContract>;
}

function eersteRij(data: unknown): Record<string, unknown> {
  const rij = Array.isArray(data) ? data[0] : data;
  if (!rij || typeof rij !== 'object') throw new Error('Atomische printbatch-RPC gaf geen resultaat.');
  return rij as Record<string, unknown>;
}

function verplichteTekst(rij: Record<string, unknown>, veld: string): string {
  const waarde = rij[veld];
  if (typeof waarde !== 'string' || !waarde.trim()) {
    throw new Error(`Atomische printbatch-RPC mist ${veld}.`);
  }
  return waarde;
}

export function maakAtomischePrintbatchSupabaseRepository(input: {
  activatie: ProductiekernActivatieBesluit;
  uitvoerder: AtomischePrintbatchRpcUitvoerder;
  klok?: () => string;
}): AtomischePrintbatchRepository {
  const klok = input.klok ?? (() => new Date().toISOString());

  return {
    async maakPrintbatchMetBrieven(command) {
      if (!input.activatie.schrijvenActief) {
        throw new ProductieTransactiesNietGeactiveerdError('maakPrintbatchMetBrieven');
      }
      if (!command.actorId.trim()) throw new Error('Actor is verplicht.');
      if (!command.operationKey.trim()) throw new Error('Operation key is verplicht.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(command.datum)) throw new Error('Batchdatum moet YYYY-MM-DD zijn.');
      if (command.brieven.length < 1 || command.brieven.length > 1000) {
        throw new Error('Printbatch vereist 1 t/m 1000 briefversies.');
      }

      const briefIds = new Set<string>();
      const versieIds = new Set<string>();
      const brieven = command.brieven.map((brief) => {
        if (!brief.briefId.trim() || !brief.briefVersieId.trim()) {
          throw new Error('Brief-ID en briefversie-ID zijn verplicht.');
        }
        if (briefIds.has(brief.briefId)) throw new Error(`Brief dubbel in printbatch: ${brief.briefId}.`);
        if (versieIds.has(brief.briefVersieId)) throw new Error(`Briefversie dubbel in printbatch: ${brief.briefVersieId}.`);
        briefIds.add(brief.briefId);
        versieIds.add(brief.briefVersieId);
        return { brief_id: brief.briefId, brief_versie_id: brief.briefVersieId };
      });

      const respons = await input.uitvoerder.rpc('off_market_printbatch_met_brieven_aanmaken', {
        p_actor_id: command.actorId,
        p_operation_key: command.operationKey,
        p_uitgevoerd_op: klok(),
        p_datum: command.datum,
        p_brieven: brieven,
      });
      if (respons.error) {
        throw new Error(respons.error.message || respons.error.code || 'Onbekende atomische printbatch-RPC-fout.');
      }

      const rij = eersteRij(respons.data);
      const id = verplichteTekst(rij, 'batch_id');
      const batchnummer = verplichteTekst(rij, 'batchnummer');
      if (!/^BAT\d{10}$/.test(batchnummer)) throw new Error('Atomische printbatch-RPC gaf een ongeldig BAT-nummer.');

      return {
        id,
        batchnummer,
        status: 'concept',
        documentversie: 1,
        aanvullingOpBatchId: null,
        printdatum: null,
        verzenddatum: null,
        geannuleerdOp: null,
        annuleringsreden: null,
      };
    },
  };
}
