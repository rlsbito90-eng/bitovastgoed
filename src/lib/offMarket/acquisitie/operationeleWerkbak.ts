import type { ReadinessFase } from '@/lib/offMarket/acquisitie/readiness';

/**
 * Dagelijkse, onderling uitsluitende werkbakken voor de Acquisitieselectie.
 *
 * `nieuwe_selectie` wordt bewust niet afgeleid uit eigenaar- of briefvelden.
 * Een dossier kan immers al gedeeltelijk onderzocht zijn zonder dat dit uit de
 * huidige readinessfase betrouwbaar blijkt. De caller moet daarom expliciet
 * aangeven of de eerste verwerking al is gestart.
 */
export type OperationeleWerkbak =
  | 'nieuwe_selectie'
  | 'eigenaar_achterhalen'
  | 'brief_opstellen'
  | 'printklaar'
  | 'geprint_posten'
  | 'opvolgen'
  | 'wachten'
  | 'afgehandeld';

export const OPERATIONELE_WERKBAK_LABEL: Record<OperationeleWerkbak, string> = {
  nieuwe_selectie: 'Nieuwe selectie',
  eigenaar_achterhalen: 'Eigenaar achterhalen',
  brief_opstellen: 'Brief opstellen',
  printklaar: 'Printklaar',
  geprint_posten: 'Geprint / posten',
  opvolgen: 'Opvolgen',
  wachten: 'Wachten',
  afgehandeld: 'Afgehandeld',
};

export interface BepaalOperationeleWerkbakInput {
  fase: ReadinessFase;
  /** Expliciete procesmarkering; nooit vervangen door een datumheuristiek. */
  verwerkingGestart: boolean;
  /** Alleen waar wanneer een werkelijk toekomstige opvolgdatum is vastgesteld. */
  wachtOpToekomstigeOpvolging: boolean;
}

/**
 * Zet het bestaande readinessmodel om naar één primaire dagelijkse werkbak.
 * KPI-kenmerken zoals `geblokkeerd` en `geadresseerd` blijven nadrukkelijk
 * buiten deze indeling en mogen dus meerdere werkbakken overlappen.
 */
export function bepaalOperationeleWerkbak(
  input: BepaalOperationeleWerkbakInput,
): OperationeleWerkbak {
  const { fase, verwerkingGestart, wachtOpToekomstigeOpvolging } = input;

  if (!verwerkingGestart && fase !== 'afgerond') return 'nieuwe_selectie';
  if (fase === 'afgerond') return 'afgehandeld';

  if (wachtOpToekomstigeOpvolging
      && (fase === 'gepost' || fase === 'email_verzonden')) {
    return 'wachten';
  }

  switch (fase) {
    case 'onderzoek_nodig':
    case 'eigenaar_ontbreekt':
    case 'adres_ontbreekt':
      return 'eigenaar_achterhalen';

    case 'brief_voorbereiden':
    case 'concept_gereed':
      return 'brief_opstellen';

    case 'gereed_voor_print':
      return 'printklaar';

    case 'geprint':
      return 'geprint_posten';

    case 'gepost':
    case 'email_verzonden':
    case 'opvolging_open':
      return 'opvolgen';

    case 'afgerond':
      return 'afgehandeld';
  }
}
