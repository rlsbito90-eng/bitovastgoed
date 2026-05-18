// src/lib/relatieContact.ts
// Centrale logica voor "Laatste contact", "Laatste activiteit" en "Volgende actie"
// op een relatie. Bron van waarheid voor "Laatste contact" zijn contactmomenten
// met een ECHTE communicatietype. Administratieve acties tellen niet mee.

import type { ContactMoment, ContactMomentType } from '@/lib/contactMoments';
import type { Taak } from '@/data/mock-data';

/** Types die als 'echt contact' tellen voor 'Laatste contact'. */
export const REAL_CONTACT_TYPES: ReadonlySet<ContactMomentType> = new Set<ContactMomentType>([
  'telefoon',
  'email',
  'whatsapp',
  'linkedin',
  'afspraak',
  'bezichtiging',
  'teaser_verstuurd',
  'nda_verstuurd',
  'nda_ontvangen',
  'informatie_gedeeld',
  'bod_ontvangen',
  'bod_uitgebracht',
  // Handmatige notitie telt mee als gebruiker hem expliciet als contactmoment logt
  // (alle handmatige contact_moments zijn is_system=false).
  'notitie',
]);

export function isRealContactMoment(cm: ContactMoment): boolean {
  // Systeem-logs tellen nooit als echt contact, ook al is het type "notitie".
  if (cm.isSystem) return false;
  return REAL_CONTACT_TYPES.has(cm.type);
}

/** Geeft de meest recente datum (YYYY-MM-DD) van een ECHT contactmoment, of undefined. */
export function getLaatsteContactDatum(
  relatieId: string,
  contactMoments: ContactMoment[],
): string | undefined {
  let best: string | undefined;
  for (const cm of contactMoments) {
    if (cm.relatieId !== relatieId) continue;
    if (!isRealContactMoment(cm)) continue;
    if (!best || cm.momentDate > best) best = cm.momentDate;
  }
  return best;
}

/** Meest recente activiteit op de relatie — inclusief systeemlogs. */
export function getLaatsteActiviteitDatum(
  relatieId: string,
  contactMoments: ContactMoment[],
): string | undefined {
  let best: string | undefined;
  for (const cm of contactMoments) {
    if (cm.relatieId !== relatieId) continue;
    if (!best || cm.momentDate > best) best = cm.momentDate;
  }
  return best;
}

/** Eerstvolgende open taak (op deadline oplopend), niet afgerond/geannuleerd. */
export function getVolgendeOpenTaak(
  relatieId: string,
  taken: Taak[],
): Taak | undefined {
  const open = taken
    .filter(t => t.relatieId === relatieId && t.status !== 'afgerond' && t.status !== 'geannuleerd' && !t.softDeletedAt)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
  return open[0];
}
