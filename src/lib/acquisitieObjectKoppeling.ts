import type { ObjectVastgoed } from '@/data/mock-data';
import type { AcquisitieTarget } from '@/lib/acquisitie';
import { vindObjectMatches, type ObjectMatchResultaat } from '@/lib/objecten/objectMatchService';

export interface AcquisitieObjectKandidaat extends ObjectMatchResultaat {
  redenLabel: string;
}

const REDEN_LABELS = {
  crm_objectnummer: 'Zelfde CRM-objectnummer',
  intern_referentienummer: 'Zelfde interne referentie',
  kadastrale_identiteit: 'Zelfde kadastrale identiteit',
  volledig_adres: 'Zelfde volledige adres',
} as const;

export function vindAcquisitieObjectKandidaten(
  target: Pick<AcquisitieTarget, 'adres' | 'postcode' | 'plaats'>,
  objecten: ObjectVastgoed[],
): AcquisitieObjectKandidaat[] {
  return vindObjectMatches(
    {
      adres: target.adres ?? undefined,
      postcode: target.postcode ?? undefined,
      plaats: target.plaats ?? undefined,
    },
    objecten,
  )
    .filter(match => match.score >= 80)
    .slice(0, 3)
    .map(match => ({
      ...match,
      redenLabel: match.redenen.map(reden => REDEN_LABELS[reden]).join(' · '),
    }));
}
