import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';

export interface BestaandConceptBridgeRpcUitvoerder {
  rpc<T = unknown>(
    naam: string,
    parameters: Record<string, unknown>,
  ): Promise<{
    data: T | null;
    error: { message?: string; code?: string } | null;
  }>;
}

export interface KoppelBestaandConceptCommand {
  selectieId: string;
  signaalId: string;
  briefId: string;
  actorId: string;
  operationKey: string;
  inhoudSnapshot: Record<string, unknown>;
  geadresseerdeSnapshot: Record<string, unknown>;
}

export interface BestaandConceptBridgeResultaat {
  briefId: string;
  signaalId: string;
  briefVersieId: string;
  versienummer: number;
}

export interface BestaandConceptBridgeRepository {
  koppelBestaandConcept(
    command: KoppelBestaandConceptCommand,
  ): Promise<BestaandConceptBridgeResultaat>;
}

function rij(data: unknown): Record<string, unknown> {
  const waarde = Array.isArray(data) ? data[0] : data;
  if (!waarde || typeof waarde !== 'object') {
    throw new Error('Bestaand-concept-bridge RPC gaf geen resultaat.');
  }
  return waarde as Record<string, unknown>;
}

function tekst(record: Record<string, unknown>, veld: string): string {
  const waarde = record[veld];
  if (typeof waarde !== 'string' || !waarde.trim()) {
    throw new Error(`Bestaand-concept-bridge RPC mist ${veld}.`);
  }
  return waarde;
}

/**
 * Afzonderlijke adapter voor het transactioneel opnemen van een bestaand
 * legacyconcept in de Productiekern.
 *
 * De adapter is bewust nog niet in de browsercompositie gemount. Hierdoor kan
 * het RPC-contract eerst geïsoleerd worden bewezen. De centrale schrijfpoort
 * blijft de enige activatiegrens.
 */
export function maakBestaandConceptBridgeSupabaseRepository(input: {
  activatie: ProductiekernActivatieBesluit;
  uitvoerder: BestaandConceptBridgeRpcUitvoerder;
  klok?: () => string;
}): BestaandConceptBridgeRepository {
  const klok = input.klok ?? (() => new Date().toISOString());

  return {
    async koppelBestaandConcept(command) {
      if (!input.activatie.schrijvenActief) {
        throw new ProductieTransactiesNietGeactiveerdError('koppelBestaandConcept');
      }

      const respons = await input.uitvoerder.rpc('off_market_bestaand_concept_koppelen', {
        p_selectie_id: command.selectieId,
        p_brief_id: command.briefId,
        p_actor_id: command.actorId,
        p_operation_key: command.operationKey,
        p_uitgevoerd_op: klok(),
        p_inhoud_snapshot: command.inhoudSnapshot,
        p_geadresseerde_snapshot: command.geadresseerdeSnapshot,
      });

      if (respons.error) {
        throw new Error(
          respons.error.message
            || respons.error.code
            || 'Onbekende bestaand-concept-bridge RPC-fout.',
        );
      }

      const record = rij(respons.data);
      const briefId = tekst(record, 'brief_id');
      const signaalId = tekst(record, 'signaal_id');
      const briefVersieId = tekst(record, 'brief_versie_id');
      const versienummer = Number(record.versienummer);

      if (briefId !== command.briefId) {
        throw new Error('Bestaand-concept-bridge RPC gaf een andere brief terug dan het commando.');
      }
      if (signaalId !== command.signaalId) {
        throw new Error('Bestaand-concept-bridge RPC gaf een ander signaal terug dan het commando.');
      }
      if (!Number.isInteger(versienummer) || versienummer < 1) {
        throw new Error('Bestaand-concept-bridge RPC gaf een ongeldig versienummer.');
      }

      return { briefId, signaalId, briefVersieId, versienummer };
    },
  };
}
