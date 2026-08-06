export type ProductiekernHandeling =
  | 'verwerking_starten'
  | 'brief_reserveren'
  | 'briefversie_maken'
  | 'printbatch_maken'
  | 'brief_aan_batch_toevoegen'
  | 'batch_geprint_markeren'
  | 'brief_gepost_markeren';

export interface ProductiekernOperationKeyInput {
  handeling: ProductiekernHandeling;
  hoofdobjectType: 'selectie' | 'brief' | 'briefversie' | 'batch';
  hoofdobjectId: string;
  verzoekId: string;
}

const VEILIGE_COMPONENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Bouwt een stabiele idempotentiesleutel voor één concrete gebruikershandeling.
 *
 * `verzoekId` moet bij retries gelijk blijven. Een nieuw bewust verzoek krijgt
 * een nieuw verzoekId. De sleutel bevat geen persoonsgegevens of vrije tekst en
 * kan daardoor veilig in de append-only productieaudit worden opgeslagen.
 */
export function maakProductiekernOperationKey(
  input: ProductiekernOperationKeyInput,
): string {
  valideerComponent('hoofdobjectId', input.hoofdobjectId);
  valideerComponent('verzoekId', input.verzoekId);

  return [
    'acq-productie',
    'v1',
    input.handeling,
    input.hoofdobjectType,
    input.hoofdobjectId,
    input.verzoekId,
  ].join(':');
}

export function isGeldigeProductiekernOperationKey(waarde: string): boolean {
  const delen = waarde.split(':');
  if (delen.length !== 6) return false;

  const [domein, versie, handeling, objectType, objectId, verzoekId] = delen;
  if (domein !== 'acq-productie' || versie !== 'v1') return false;
  if (!PRODUCTIEKERN_HANDELINGEN.has(handeling as ProductiekernHandeling)) return false;
  if (!PRODUCTIEKERN_OBJECTTYPEN.has(objectType)) return false;

  return VEILIGE_COMPONENT.test(objectId) && VEILIGE_COMPONENT.test(verzoekId);
}

const PRODUCTIEKERN_HANDELINGEN = new Set<ProductiekernHandeling>([
  'verwerking_starten',
  'brief_reserveren',
  'briefversie_maken',
  'printbatch_maken',
  'brief_aan_batch_toevoegen',
  'batch_geprint_markeren',
  'brief_gepost_markeren',
]);

const PRODUCTIEKERN_OBJECTTYPEN = new Set([
  'selectie',
  'brief',
  'briefversie',
  'batch',
]);

function valideerComponent(naam: string, waarde: string): void {
  if (!VEILIGE_COMPONENT.test(waarde)) {
    throw new Error(
      `${naam} moet 1–128 tekens bevatten en uitsluitend letters, cijfers, punt, underscore of koppelteken gebruiken.`,
    );
  }
}
