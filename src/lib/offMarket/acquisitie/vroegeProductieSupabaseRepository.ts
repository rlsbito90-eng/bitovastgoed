import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';

export type VroegeProductieWriteRepository = Pick<
  AcquisitieProductiekernRepository,
  'startVerwerking' | 'reserveerBrief' | 'maakBriefversie' | 'maakPrintbatch' | 'voegBriefversieToeAanBatch'
>;

export interface VroegeRpcUitvoerder {
  rpc<T = unknown>(naam: string, parameters: Record<string, unknown>): Promise<{ data: T | null; error: { message?: string; code?: string } | null }>;
}

function rij(data: unknown, entiteit: string): Record<string, unknown> {
  const waarde = Array.isArray(data) ? data[0] : data;
  if (!waarde || typeof waarde !== 'object') throw new Error(`${entiteit}-RPC gaf geen resultaat.`);
  return waarde as Record<string, unknown>;
}
function tekst(record: Record<string, unknown>, veld: string, entiteit: string): string {
  const value = record[veld];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${entiteit}-RPC mist ${veld}.`);
  return value;
}
function rpcFout(error: { message?: string; code?: string } | null): void {
  if (error) throw new Error(error.message || error.code || 'Onbekende productiekern-RPC-fout.');
}

export function maakVroegeProductieSupabaseRepository(input: {
  activatie: ProductiekernActivatieBesluit;
  uitvoerder: VroegeRpcUitvoerder;
  klok?: () => string;
}): VroegeProductieWriteRepository {
  const klok = input.klok ?? (() => new Date().toISOString());
  function bewaak(handeling: string): void {
    if (!input.activatie.schrijvenActief) throw new ProductieTransactiesNietGeactiveerdError(handeling);
  }

  return {
    async startVerwerking(command) {
      bewaak('startVerwerking');
      const uitgevoerdOp = klok();
      const result = await input.uitvoerder.rpc('off_market_verwerking_starten', {
        p_selectie_id: command.selectieId,
        p_actor_id: command.actorId,
        p_operation_key: command.operationKey,
        p_uitgevoerd_op: uitgevoerdOp,
      });
      rpcFout(result.error);
      const record = rij(result.data, 'Acquisitiedossier');
      return {
        selectieId: tekst(record, 'selectie_id', 'Acquisitiedossier'),
        signaalId: tekst(record, 'signaal_id', 'Acquisitiedossier'),
        objectId: null,
        verwerkingGestartOp: uitgevoerdOp,
        verwerkingGestartDoor: command.actorId,
        primaireWerkbak: 'eigenaar_achterhalen',
        volgendeActieOp: null,
        volgendeActieOmschrijving: null,
      };
    },

    async reserveerBrief(command) {
      bewaak('reserveerBrief');
      if (!Number.isInteger(command.jaar) || command.jaar < 2000 || command.jaar > 9999) throw new Error('Briefjaar is ongeldig.');
      const result = await input.uitvoerder.rpc('off_market_brief_reserveren', {
        p_selectie_id: command.selectieId,
        p_actor_id: command.actorId,
        p_operation_key: command.operationKey,
        p_uitgevoerd_op: klok(),
      });
      rpcFout(result.error);
      const record = rij(result.data, 'Brief');
      const signaalId = tekst(record, 'signaal_id', 'Brief');
      if (signaalId !== command.signaalId) throw new Error('Brief-RPC gaf een ander signaal terug dan het commando.');
      return {
        id: tekst(record, 'brief_id', 'Brief'), briefnummer: null, signaalId,
        selectieId: command.selectieId, objectId: null, relatieId: null,
        actieveVersie: null, status: 'concept', vervangingVanBriefId: null,
        definitiefOp: null, vergrendeldOp: null, annuleringsreden: null,
      };
    },

    async maakBriefversie(command) {
      bewaak('maakBriefversie');
      const uitgevoerdOp = klok();
      const result = await input.uitvoerder.rpc('off_market_briefversie_aanmaken', {
        p_brief_id: command.briefId,
        p_actor_id: command.actorId,
        p_operation_key: command.operationKey,
        p_uitgevoerd_op: uitgevoerdOp,
        p_inhoud_snapshot: command.inhoudSnapshot,
        p_geadresseerde_snapshot: command.geadresseerdeSnapshot,
      });
      rpcFout(result.error);
      const record = rij(result.data, 'Briefversie');
      const versienummer = Number(record.versienummer);
      if (!Number.isInteger(versienummer) || versienummer < 1) throw new Error('Briefversie-RPC gaf ongeldig versienummer.');
      return {
        id: tekst(record, 'brief_versie_id', 'Briefversie'), briefId: command.briefId,
        versienummer, status: 'actief', inhoud: command.inhoudSnapshot as never,
        geadresseerde: command.geadresseerdeSnapshot as never, bestandReferentie: null,
        createdAt: uitgevoerdOp, vervallenOp: null, verzondenOp: null,
      };
    },

    async maakPrintbatch(command) {
      bewaak('maakPrintbatch');
      const uitgevoerdOp = klok();
      const result = await input.uitvoerder.rpc('off_market_printbatch_aanmaken', {
        p_actor_id: command.actorId,
        p_operation_key: command.operationKey,
        p_uitgevoerd_op: uitgevoerdOp,
        p_datum: command.datum,
      });
      rpcFout(result.error);
      const record = rij(result.data, 'Printbatch');
      return {
        id: tekst(record, 'batch_id', 'Printbatch'), batchnummer: tekst(record, 'batchnummer', 'Printbatch'),
        status: 'concept', documentversie: 1, aanvullingOpBatchId: null,
        printdatum: null, verzenddatum: null, geannuleerdOp: null, annuleringsreden: null,
      };
    },

    async voegBriefversieToeAanBatch(command) {
      bewaak('voegBriefversieToeAanBatch');
      const result = await input.uitvoerder.rpc('off_market_briefversie_aan_batch_toevoegen', {
        p_batch_id: command.batchId,
        p_brief_id: command.briefId,
        p_brief_versie_id: command.briefVersieId,
        p_actor_id: command.actorId,
        p_operation_key: command.operationKey,
        p_uitgevoerd_op: klok(),
      });
      rpcFout(result.error);
    },
  };
}
