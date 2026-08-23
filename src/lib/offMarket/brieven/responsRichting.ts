export type ResponsRichting = 'verkoper' | 'koper' | 'beide' | 'overig_onbekend';

export const RESPONS_RICHTING_LABEL: Record<ResponsRichting, string> = {
  verkoper: 'Verkoper / aanbod',
  koper: 'Koper / zoekvraag',
  beide: 'Beide',
  overig_onbekend: 'Overig / onbekend',
};

export const RESPONS_RICHTING_VOLGORDE: ResponsRichting[] = ['verkoper', 'koper', 'beide', 'overig_onbekend'];

export const isVerkoperRichting = (v: string | null | undefined) => v === 'verkoper' || v === 'beide';
export const isKoperRichting = (v: string | null | undefined) => v === 'koper' || v === 'beide';
