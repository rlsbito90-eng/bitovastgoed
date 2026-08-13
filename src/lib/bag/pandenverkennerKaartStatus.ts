export type BagKaartWorkflowStatus =
  | 'nieuw'
  | 'geselecteerd'
  | 'vastgoedkans'
  | 'acquisitie'
  | 'gearchiveerd'
  | 'crm_bekend';

interface BagKaartWorkflowStatusInput {
  crmBron: 'vastgoedkans' | 'object' | 'signaal' | null;
  vastgoedkansGearchiveerd?: boolean;
  vastgoedkansInAcquisitie?: boolean;
  lokaalGeselecteerd?: boolean;
}

export const BAG_KAART_WORKFLOW_LABEL: Record<BagKaartWorkflowStatus, string> = {
  nieuw: 'Nieuw',
  geselecteerd: 'Geselecteerd',
  vastgoedkans: 'Vastgoedkans',
  acquisitie: 'In Acquisitieselectie',
  gearchiveerd: 'Gearchiveerd',
  crm_bekend: 'Al bekend in CRM',
};

export function bepaalBagKaartWorkflowStatus({
  crmBron,
  vastgoedkansGearchiveerd = false,
  vastgoedkansInAcquisitie = false,
  lokaalGeselecteerd = false,
}: BagKaartWorkflowStatusInput): BagKaartWorkflowStatus {
  if (crmBron === 'vastgoedkans') {
    if (vastgoedkansGearchiveerd) return 'gearchiveerd';
    if (vastgoedkansInAcquisitie) return 'acquisitie';
    return 'vastgoedkans';
  }
  if (crmBron) return 'crm_bekend';
  if (lokaalGeselecteerd) return 'geselecteerd';
  return 'nieuw';
}
