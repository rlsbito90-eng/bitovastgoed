// src/lib/relatieNaam.ts
//
// Centrale helper voor het weergeven van een relatie-naam in de app.
// Vanaf batch 10: contactpersoon staat bovenaan (primair), bedrijfsnaam
// eronder. Bedrijfsnaam is niet langer verplicht.
//
// Gebruik:
//   const { primair, secundair } = getRelatieNamen(relatie, contactpersonen);
//   <p className="font-medium">{primair}</p>
//   {secundair && <p className="text-xs text-muted-foreground">{secundair}</p>}

import type { Relatie, RelatieContactpersoon, PartijType } from '@/data/mock-data';

// Waarden die in de DB als placeholder zijn beland maar in UI als "leeg"
// moeten gelden. Voorkomt dat "Onbekend" prominent in agenda/taken/lijsten
// verschijnt voor relaties zonder echte bedrijfsnaam.
const PLACEHOLDER_NAMES = new Set(['onbekend', 'onbekende relatie', 'naamloos', '-', '–']);

const clean = (v?: string | null): string => {
  const s = (v ?? '').trim();
  if (!s) return '';
  if (PLACEHOLDER_NAMES.has(s.toLowerCase())) return '';
  return s;
};

const PARTIJ_TYPE_LABELS: Record<PartijType, string> = {
  belegger: 'Belegger',
  ontwikkelaar: 'Ontwikkelaar',
  eigenaar: 'Eigenaar',
  makelaar: 'Makelaar',
  partner: 'Partner',
  overig: 'Relatie',
};

export interface RelatieNamen {
  /** Wat bovenaan komt - de "hoofdnaam" van de relatie */
  primair: string;
  /** Optioneel - bedrijfsnaam onder de contactpersoon, of null */
  secundair: string | null;
  /** True als er helemaal geen naam is ingevuld - relatie is dan "naamloos" */
  isLeeg: boolean;
}

/**
 * Bepaalt hoe een relatie-naam getoond moet worden.
 *
 * Volgorde:
 * 1. Primaire contactpersoon (uit relatie_contactpersonen waar is_primair=true)
 *    -> contactpersoon = primair, bedrijfsnaam = secundair
 * 2. Oude contactpersoon-tekstveld op relatie zelf
 *    -> dat veld = primair, bedrijfsnaam = secundair
 * 3. Alleen bedrijfsnaam aanwezig
 *    -> bedrijfsnaam = primair, geen secundair
 * 4. Niets ingevuld
 *    -> primair = "(naamloze relatie)", isLeeg = true
 */
export function getRelatieNamen(
  relatie: Relatie | null | undefined,
  contactpersonen?: RelatieContactpersoon[],
): RelatieNamen {
  if (!relatie) {
    return { primair: 'Relatie zonder naam', secundair: null, isLeeg: true };
  }

  const bedrijfsnaam = clean(relatie.bedrijfsnaam) || null;

  // 1. Probeer primaire contactpersoon
  const primaireCp = contactpersonen?.find(c => c.relatieId === relatie.id && c.isPrimair);
  const primaireNaam = clean(primaireCp?.naam);
  if (primaireNaam) {
    return { primair: primaireNaam, secundair: bedrijfsnaam, isLeeg: false };
  }

  // 2. Fallback: oude contactpersoon-veld op relatie zelf
  const oudeCp = clean(relatie.contactpersoon);
  if (oudeCp) {
    return { primair: oudeCp, secundair: bedrijfsnaam, isLeeg: false };
  }

  // 3. Geen contactpersoon, wel bedrijfsnaam
  if (bedrijfsnaam) {
    return { primair: bedrijfsnaam, secundair: null, isLeeg: false };
  }

  // 4. Fallback op e-mail/telefoon/type-label
  const email = clean(relatie.email) || clean(primaireCp?.email);
  if (email) return { primair: email, secundair: null, isLeeg: true };

  const tel = clean(relatie.telefoon) || clean(primaireCp?.telefoon) || clean(primaireCp?.telefoonMobiel);
  if (tel) return { primair: tel, secundair: null, isLeeg: true };

  const typeLabel = relatie.type ? PARTIJ_TYPE_LABELS[relatie.type] : '';
  if (typeLabel) return { primair: `${typeLabel} zonder naam`, secundair: null, isLeeg: true };

  return { primair: 'Relatie zonder naam', secundair: null, isLeeg: true };
}

/**
 * App-brede primaire weergavenaam voor een relatie/kandidaat in één regel.
 * Gebruikt in agenda-titels, taken, kandidaatlijsten, notificaties.
 * Geeft NOOIT "Onbekend" terug.
 */
export function getRelationDisplayName(
  relatie: Relatie | null | undefined,
  contactpersonen?: RelatieContactpersoon[],
): string {
  return getRelatieNamen(relatie, contactpersonen).primair;
}

/**
 * Compacte versie voor 1 regel: "Contactpersoon · Bedrijfsnaam" of alleen
 * één van beide. Handig voor dropdown-items, taken-lijst, search-resultaten.
 */
export function getRelatieNaamCompact(
  relatie: Relatie | null | undefined,
  contactpersonen?: RelatieContactpersoon[],
): string {
  const { primair, secundair } = getRelatieNamen(relatie, contactpersonen);
  if (secundair) return `${primair} · ${secundair}`;
  return primair;
}

/**
 * Bouwt een eenduidig label voor een relatie in dropdowns en lijsten.
 * Voorkomt meerdere identieke "Onbekend"-opties.
 *
 * Volgorde:
 *   1. "Bedrijfsnaam – Contactpersoon" als beide bekend
 *   2. "Bedrijfsnaam"
 *   3. "Contactpersoon"
 *   4. "Onbekende relatie – e-mail/telefoon"
 *   5. "Onbekende relatie – [korte ID]"
 */
export function getRelatieDropdownLabel(
  relatie: Relatie | null | undefined,
  contactpersonen?: RelatieContactpersoon[],
): string {
  if (!relatie) return 'Onbekende relatie';

  const bedrijfsnaam = relatie.bedrijfsnaam?.trim() || '';

  // Contactpersoon: eerst primaire uit relatie_contactpersonen, anders oud veld
  const primaireCp = contactpersonen?.find(c => c.relatieId === relatie.id && c.isPrimair);
  const contactpersoon =
    primaireCp?.naam?.trim() ||
    relatie.contactpersoon?.trim() ||
    '';

  const email =
    relatie.email?.trim() ||
    primaireCp?.email?.trim() ||
    '';

  if (bedrijfsnaam && contactpersoon) return `${bedrijfsnaam} – ${contactpersoon}`;
  if (bedrijfsnaam) return bedrijfsnaam;
  if (contactpersoon && email) return `${contactpersoon} – ${email}`;
  if (contactpersoon) return contactpersoon;
  if (email) return `Onbekende relatie – ${email}`;

  const telefoon =
    relatie.telefoon?.trim() ||
    primaireCp?.telefoon?.trim() ||
    primaireCp?.telefoonMobiel?.trim() ||
    '';
  if (telefoon) return `Onbekende relatie – ${telefoon}`;

  const kortId = relatie.id ? relatie.id.slice(0, 6) : 'zonder ID';
  return `Onbekende relatie – ${kortId}`;
}

/**
 * Sorteert relaties alfabetisch op het dropdown-label (case-insensitive,
 * Nederlandse locale). Retourneert een nieuwe array.
 */
export function sorteerRelatiesVoorDropdown(
  relaties: Relatie[],
  contactpersonen?: RelatieContactpersoon[],
): Relatie[] {
  return [...relaties].sort((a, b) => {
    const la = getRelatieDropdownLabel(a, contactpersonen);
    const lb = getRelatieDropdownLabel(b, contactpersonen);
    return la.localeCompare(lb, 'nl', { sensitivity: 'base' });
  });
}
