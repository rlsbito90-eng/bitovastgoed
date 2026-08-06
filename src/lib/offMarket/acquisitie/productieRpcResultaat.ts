import type { ProductieRpcNaam } from './productieRpcContract';

export type ProductieRpcFoutcode =
  | 'operation_key_verplicht'
  | 'ongeldig_verwacht_versienummer'
  | 'brief_niet_gevonden'
  | 'brief_niet_concept'
  | 'briefnummer_bestaat_al'
  | 'actieve_briefversie_niet_gevonden'
  | 'optimistic_lock_conflict'
  | 'exact_vier_batchdocumenten_verplicht'
  | 'batch_niet_gevonden'
  | 'batchstatus_blokkeert_documentregistratie'
  | 'ongeldig_documenttype'
  | 'bestand_referentie_verplicht'
  | 'ieder_documenttype_exact_een_keer_verplicht'
  | 'batch_niet_printklaar'
  | 'printdatum_bestaat_al'
  | 'brief_niet_definitief'
  | 'briefversie_niet_gevonden'
  | 'briefversie_niet_in_batch'
  | 'batch_niet_geprint'
  | 'geadresseerde_key_verplicht'
  | 'onbekende_productiefout';

const BEKENDE_FOUTCODES = new Set<ProductieRpcFoutcode>([
  'operation_key_verplicht',
  'ongeldig_verwacht_versienummer',
  'brief_niet_gevonden',
  'brief_niet_concept',
  'briefnummer_bestaat_al',
  'actieve_briefversie_niet_gevonden',
  'optimistic_lock_conflict',
  'exact_vier_batchdocumenten_verplicht',
  'batch_niet_gevonden',
  'batchstatus_blokkeert_documentregistratie',
  'ongeldig_documenttype',
  'bestand_referentie_verplicht',
  'ieder_documenttype_exact_een_keer_verplicht',
  'batch_niet_printklaar',
  'printdatum_bestaat_al',
  'brief_niet_definitief',
  'briefversie_niet_gevonden',
  'briefversie_niet_in_batch',
  'batch_niet_geprint',
  'geadresseerde_key_verplicht',
]);

export interface ProductieRpcFout {
  code: ProductieRpcFoutcode;
  rpc: ProductieRpcNaam;
  retrybaar: boolean;
  veiligBericht: string;
  technischeMelding: string | null;
}

const VEILIGE_BERICHTEN: Record<ProductieRpcFoutcode, string> = {
  operation_key_verplicht: 'De productiehandeling mist een idempotentiesleutel.',
  ongeldig_verwacht_versienummer: 'De verwachte versie is ongeldig.',
  brief_niet_gevonden: 'De brief bestaat niet meer of is niet toegankelijk.',
  brief_niet_concept: 'De brief is niet langer een concept.',
  briefnummer_bestaat_al: 'De brief heeft al een definitief briefnummer.',
  actieve_briefversie_niet_gevonden: 'De actieve briefversie kon niet worden vastgesteld.',
  optimistic_lock_conflict: 'De gegevens zijn intussen gewijzigd. Ververs en probeer opnieuw.',
  exact_vier_batchdocumenten_verplicht: 'De batchdocumentenset is niet compleet.',
  batch_niet_gevonden: 'De printbatch bestaat niet meer of is niet toegankelijk.',
  batchstatus_blokkeert_documentregistratie: 'De batchstatus staat documentregistratie niet toe.',
  ongeldig_documenttype: 'De batch bevat een onbekend documenttype.',
  bestand_referentie_verplicht: 'Een document mist een geldige bestandsreferentie.',
  ieder_documenttype_exact_een_keer_verplicht: 'Ieder vereist batchdocument moet precies één keer aanwezig zijn.',
  batch_niet_printklaar: 'De batch is niet printklaar.',
  printdatum_bestaat_al: 'Voor deze batch is al een printdatum geregistreerd.',
  brief_niet_definitief: 'Alleen een definitieve brief kan als gepost worden geregistreerd.',
  briefversie_niet_gevonden: 'De geselecteerde briefversie bestaat niet meer.',
  briefversie_niet_in_batch: 'De briefversie hoort niet bij deze printbatch.',
  batch_niet_geprint: 'De batch is nog niet expliciet als geprint geregistreerd.',
  geadresseerde_key_verplicht: 'De geadresseerde-identiteit ontbreekt.',
  onbekende_productiefout: 'De productiehandeling kon niet veilig worden afgerond.',
};

function leesFoutcode(melding: string | null | undefined): ProductieRpcFoutcode {
  const genormaliseerd = (melding ?? '').toLowerCase();
  for (const code of BEKENDE_FOUTCODES) {
    if (genormaliseerd.includes(code)) return code;
  }
  return 'onbekende_productiefout';
}

export function normaliseerProductieRpcFout(input: {
  rpc: ProductieRpcNaam;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): ProductieRpcFout {
  const technischeMelding = [input.message, input.details, input.hint]
    .filter((waarde): waarde is string => Boolean(waarde?.trim()))
    .join(' | ') || null;
  const code = leesFoutcode(technischeMelding);

  return {
    code,
    rpc: input.rpc,
    retrybaar: code === 'optimistic_lock_conflict' || code === 'onbekende_productiefout',
    veiligBericht: VEILIGE_BERICHTEN[code],
    technischeMelding,
  };
}

export interface BriefDefinitiefRpcResultaat {
  briefId: string;
  briefnummer: string;
}

export function parseBriefDefinitiefRpcResultaat(data: unknown): BriefDefinitiefRpcResultaat {
  const rij = Array.isArray(data) ? data[0] : data;
  if (!rij || typeof rij !== 'object') {
    throw new Error('Ongeldig RPC-resultaat: briefresultaat ontbreekt.');
  }

  const record = rij as Record<string, unknown>;
  if (typeof record.brief_id !== 'string' || !record.brief_id.trim()) {
    throw new Error('Ongeldig RPC-resultaat: brief_id ontbreekt.');
  }
  if (typeof record.briefnummer !== 'string' || !/^BR\d{10}$/.test(record.briefnummer)) {
    throw new Error('Ongeldig RPC-resultaat: briefnummer heeft een ongeldig formaat.');
  }

  return { briefId: record.brief_id, briefnummer: record.briefnummer };
}

export function bevestigLeegRpcResultaat(data: unknown): void {
  if (data !== null && data !== undefined) {
    throw new Error('Ongeldig RPC-resultaat: lege bevestiging verwacht.');
  }
}
