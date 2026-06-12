// Helpers voor de eigenaar-opvolgflow vanuit een off-market signaal.
// - signaalNaarRelatiePrefill: mapping van eigenaargegevens op een signaal
//   naar een prefill-object voor RelatieFormDialog.
// - EIGENAAR_TAAK_TEMPLATES: standaardtemplates voor opvolgtaken.
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { PartijType, TaakPrioriteit } from '@/data/mock-data';
import type { TAAK_TYPES } from '@/lib/taakHelpers';

export interface RelatiePrefill {
  /** Velden voor de relatie (Partial<FormState> van RelatieFormDialog) */
  relatie: Record<string, unknown>;
  /** Velden voor de primaire contactpersoon-input */
  contactpersoon: {
    naam?: string;
    email?: string;
    telefoon?: string;
  };
}

export function signaalNaarRelatiePrefill(signaal: OffMarketSignaal): RelatiePrefill {
  const a = signaal as any;
  const eigenaarType = a.eigenaar_type as string | null | undefined;

  // Mapping van eigenaar_type → PartijType. We hebben in onze relatie-enum
  // alleen "eigenaar"/"belegger"/"ontwikkelaar"/"makelaar"/"partner"/"overig".
  // Voor alle off-market eigenaren is "eigenaar" het best passend.
  const typePartij: PartijType = eigenaarType === 'overheid' ? 'overig' : 'eigenaar';

  const bedrijfsnaam =
    (a.eigenaar_bedrijfsnaam && String(a.eigenaar_bedrijfsnaam).trim()) ||
    (a.eigenaar_naam && String(a.eigenaar_naam).trim()) ||
    '';

  return {
    relatie: {
      bedrijfsnaam,
      type: typePartij,
      telefoon: a.eigenaar_telefoon ?? '',
      email: a.eigenaar_email ?? '',
      website: a.eigenaar_website ?? undefined,
      linkedinUrl: a.eigenaar_linkedin ?? undefined,
      kvkNummer: a.eigenaar_kvk ?? undefined,
      vestigingsplaats: signaal.plaats ?? undefined,
      vestigingspostcode: (a.postcode as string | null) ?? undefined,
      bronRelatie: 'off_market_radar',
    },
    contactpersoon: {
      naam: a.eigenaar_naam ?? '',
      email: a.eigenaar_email ?? '',
      telefoon: a.eigenaar_telefoon ?? '',
    },
  };
}

export type TaakType = (typeof TAAK_TYPES)[number];

export interface EigenaarTaakTemplate {
  id: string;
  label: string;
  titel: string;
  type: TaakType;
  prioriteit: TaakPrioriteit;
  /** Aantal dagen vanaf vandaag voor de standaard-deadline. */
  dagen: number;
}

export const EIGENAAR_TAAK_TEMPLATES: EigenaarTaakTemplate[] = [
  { id: 'achterhalen', label: 'Eigenaar achterhalen', titel: 'Eigenaar achterhalen', type: 'Algemeen', prioriteit: 'hoog', dagen: 2 },
  { id: 'kadaster', label: 'Kadaster check uitvoeren', titel: 'Kadaster check uitvoeren', type: 'Analyse maken', prioriteit: 'normaal', dagen: 2 },
  { id: 'kvk', label: 'KVK check uitvoeren', titel: 'KVK check uitvoeren', type: 'Analyse maken', prioriteit: 'normaal', dagen: 2 },
  { id: 'bellen', label: 'Eigenaar bellen', titel: 'Eigenaar bellen', type: 'Bellen', prioriteit: 'hoog', dagen: 1 },
  { id: 'email', label: 'E-mail naar eigenaar', titel: 'E-mail naar eigenaar sturen', type: 'E-mailen', prioriteit: 'normaal', dagen: 1 },
  { id: 'opvolgen', label: 'Opvolgen na contact', titel: 'Opvolgen na contact', type: 'Follow-up', prioriteit: 'normaal', dagen: 5 },
  { id: 'documenten', label: 'Documentatie opvragen', titel: 'Documentatie opvragen', type: 'Documenten opvragen', prioriteit: 'normaal', dagen: 3 },
];

/** Geef YYYY-MM-DD voor vandaag + N dagen (lokale tijd). */
export function deadlineOverDagen(dagen: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dagen);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Bouw een standaard notitie-context voor taken die vanuit een off-market
 * signaal worden aangemaakt. Bevat altijd minimaal signaaltitel + adres
 * + postcode/plaats, ongeacht of er ook een signaal_id-koppeling is.
 */
export function bouwSignaalTaakContext(
  signaal: OffMarketSignaal,
  actie?: string,
): string {
  const a = signaal as any;
  const adresRegel = [a.adres, [a.postcode, a.plaats].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');
  const regels = [
    `Signaal: ${signaal.titel}`,
    adresRegel ? `Adres: ${adresRegel}` : null,
    `Context: Off Market Radar${actie ? ` — ${actie}` : ''}`,
  ].filter(Boolean) as string[];
  return regels.join('\n');
}
