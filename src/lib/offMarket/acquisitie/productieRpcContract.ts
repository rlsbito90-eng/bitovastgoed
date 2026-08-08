import type {
  BatchDocumentenRegistrerenInput,
  BatchGeprintMarkerenInput,
  BriefDefinitiefMakenInput,
  BriefGepostMarkerenInput,
  ProductieTransactieInput,
} from './productieTransactieContract';
import { valideerProductieTransactie } from './productieTransactieContract';

export type ProductieRpcNaam =
  | 'off_market_brief_definitief_maken'
  | 'off_market_batch_documenten_registreren'
  | 'off_market_batch_geprint_markeren'
  | 'off_market_brief_gepost_markeren';

export interface ProductieRpcAanroep {
  rpc: ProductieRpcNaam;
  parameters: Record<string, unknown>;
}

function briefDefinitiefParameters(
  input: BriefDefinitiefMakenInput,
): ProductieRpcAanroep {
  return {
    rpc: 'off_market_brief_definitief_maken',
    parameters: {
      p_brief_id: input.brief.id,
      p_brief_versie_id: input.actieveVersie.id,
      p_actor_id: input.actorId,
      p_operation_key: input.operationKey,
      p_verwacht_versienummer: input.verwachtVersienummer,
      p_uitgevoerd_op: input.uitgevoerdOp,
      p_jaar: input.jaar,
    },
  };
}

function batchDocumentenParameters(
  input: BatchDocumentenRegistrerenInput,
): ProductieRpcAanroep {
  return {
    rpc: 'off_market_batch_documenten_registreren',
    parameters: {
      p_batch_id: input.batch.id,
      p_actor_id: input.actorId,
      p_operation_key: input.operationKey,
      p_verwacht_documentversie: input.verwachtVersienummer,
      p_uitgevoerd_op: input.uitgevoerdOp,
      p_documenten: input.opgeslagenDocumenten.map(document => ({
        documenttype: document.documenttype,
        bestand_referentie: document.bestandReferentie,
        metadata: document.metadata,
      })),
    },
  };
}

function batchGeprintParameters(
  input: BatchGeprintMarkerenInput,
): ProductieRpcAanroep {
  return {
    rpc: 'off_market_batch_geprint_markeren',
    parameters: {
      p_batch_id: input.batch.id,
      p_actor_id: input.actorId,
      p_operation_key: input.operationKey,
      p_verwacht_documentversie: input.verwachtVersienummer,
      p_printdatum: input.printdatum,
    },
  };
}

function briefGepostParameters(
  input: BriefGepostMarkerenInput,
): ProductieRpcAanroep {
  return {
    rpc: 'off_market_brief_gepost_markeren',
    parameters: {
      p_brief_id: input.brief.id,
      p_brief_versie_id: input.actieveVersie.id,
      p_batch_id: input.batch.id,
      p_geadresseerde_key: input.geadresseerdeKey,
      p_actor_id: input.actorId,
      p_operation_key: input.operationKey,
      p_verwacht_versienummer: input.verwachtVersienummer,
      p_verzenddatum: input.verzenddatum,
    },
  };
}

/**
 * Pure grens tussen gevalideerde domeininput en toekomstige Supabase-RPC's.
 * Namen en parameters spiegelen exact het niet-toegepaste SQL-concept.
 * Er wordt bewust geen Supabase-client aangeroepen.
 */
export function bouwProductieRpcAanroep(
  input: ProductieTransactieInput,
): ProductieRpcAanroep {
  const validatie = valideerProductieTransactie(input);
  if (!validatie.geldig) {
    throw new Error(`Ongeldige productietransactie: ${validatie.fouten.join(' ')}`);
  }

  switch (input.actie) {
    case 'brief_definitief_maken':
      return briefDefinitiefParameters(input);
    case 'batch_documenten_registreren':
      return batchDocumentenParameters(input);
    case 'batch_geprint_markeren':
      return batchGeprintParameters(input);
    case 'brief_gepost_markeren':
      return briefGepostParameters(input);
  }
}
