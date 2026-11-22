import type { CrmObjectInput, CrmRelatieInput } from './rolMandaatAdapter';

/**
 * Match uitsluitend op de rol binnen dit specifieke object, niet op het
 * generieke partijtype (een makelaar kan elders zelf belegger zijn).
 *
 * Prioriteit: gekoppelde relatie-ID, daarna exact dezelfde e-mail of
 * volledige naam uit de vrije verkoper-/objectcontactvelden. Geen fuzzy
 * naammatching: die kan onschuldige kopers uitsluiten.
 */
function normaliseerNaam(waarde?: string | null): string {
  return (waarde ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('nl-NL')
    .replace(/\s+/g, ' ');
}

function normaliseerEmail(waarde?: string | null): string {
  return (waarde ?? '').trim().toLowerCase();
}

export function isObjectAanbiederRelatie(
  object: CrmObjectInput,
  relatie: CrmRelatieInput,
): boolean {
  if (!object?.id || !relatie?.id) return false;

  if (object.eigenaarRelatieId && object.eigenaarRelatieId === relatie.id) return true;

  const objectEmails = [object.verkoperEmail, object.contactEmail]
    .map(normaliseerEmail)
    .filter(Boolean);
  const contactEmails = [relatie.email, ...(relatie.contactEmails ?? [])]
    .map(normaliseerEmail)
    .filter(Boolean);
  if (objectEmails.length && contactEmails.some(email => objectEmails.includes(email))) {
    return true;
  }

  // Alleen volledige, expliciete namen vergelijken; geen gedeeltelijke
  // matches zoals 'Jorg' versus 'Jorgen' of een naam uit interne notities.
  const objectNamen = [object.verkoperNaam, object.contactNaam]
    .map(normaliseerNaam)
    .filter(naam => naam.length >= 7);
  if (!objectNamen.length) return false;

  const relatieNamen = [
    relatie.bedrijfsnaam, relatie.contactpersoon, ...(relatie.contactpersoonNamen ?? []),
  ].map(normaliseerNaam).filter(Boolean);

  return relatieNamen.some(naam => objectNamen.includes(naam));
}
