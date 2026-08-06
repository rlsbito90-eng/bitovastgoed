import type {
  BatchDocumentenRegistrerenInput,
  BatchGeprintMarkerenInput,
  BriefDefinitiefMakenInput,
  BriefGepostMarkerenInput,
  ProductieTransactieInput,
} from './productieTransactieContract';
import { valideerProductieTransactie } from './productieTransactieContract';

export type ProductieRpcNaam =
  | 'maak_off_market_brief_definitief'
  | 'registreer_off_market_batchdocumenten'
  | 'markeer_off_market_batch_geprint'
  | 'markeer_off_market_brief_gepost';

export interface ProductieRpcAanroep {
  rpc: ProductieRpcNaam;
  parameters: Record<string, unknown>;
}

function basisParameters(input: ProductieTransactieInput): Record<string, unknown> {
  return {
    p_actor_id: input.actorId,
    p_operation_key: input.operationKey,
    p_verwacht_versienummer: input.verwachtVersienummer,
    p_uitgevoerd_op: input.uitgevoerdOp,
  };
}

function briefDefinitiefParameters(
  input: BriefDefinitiefMakenInput,
): ProductieRpcAanroep {
  return {
    rpc: 'maak_off_market_brief_definitief',
    parameters: {
      ...basisParameters(input),
      p_brief_id: input.brief.id,
      p_brief_versie_id: input.actieveVersie.id,
      p_gereserveerd_briefnummer: input.gereserveerdBriefnummer,
    },
  };
}

function batchDocumentenParameters(
  input: BatchDocumentenRegistrerenInput,
): ProductieRpcAanroep {
  return {
    rpc: 'registreer_off_market_batchdocumenten',
    parameters: {
      ...basisParameters(input),
      p_batch_id: input.batch.id,
      p_documentversie: input.plan.documentversie,
      p_documenten: input.opgeslagenDocumenten.map(document => ({
        id: document.id,
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
    rpc: 'markeer_off_market_batch_geprint',
    parameters: {
      ...basisParameters(input),
      p_batch_id: input.batch.id,
      p_printdatum: input.printdatum,
    },
  };
}

function briefGepostParameters(
  input: BriefGepostMarkerenInput,
): ProductieRpcAanroep {
  return {
    rpc: 'markeer_off_market_brief_gepost',
    parameters: {
      ...basisParameters(input),
      p_brief_id: input.brief.id,
      p_brief_versie_id: input.actieveVersie.id,
      p_batch_id: input.batch.id,
      p_verzenddatum: input.verzenddatum,
      p_geadresseerde_key: input.geadresseerdeKey,
    },
  };
}

/**
 * Pure grens tussen gevalideerde domeininput en toekomstige Supabase-RPC's.
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
