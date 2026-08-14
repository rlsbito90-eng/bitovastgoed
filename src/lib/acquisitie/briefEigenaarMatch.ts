import type { AcquisitieBrief } from '@/hooks/useAcquisitieBrieven';

export interface BriefEigenaarIdentiteit {
  id: string;
  naam: string;
  bedrijfsnaam?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}

export function normaliseerBriefEigenaarWaarde(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatteerPostcode(value: string | null | undefined) {
  const compact = (value ?? '').replace(/\s+/g, '').toUpperCase();
  return /^\d{4}[A-Z]{2}$/.test(compact)
    ? `${compact.slice(0, 4)} ${compact.slice(4)}`
    : (value ?? '').trim();
}

export function briefEigenaarNaam(eigenaar: BriefEigenaarIdentiteit) {
  return eigenaar.bedrijfsnaam || eigenaar.naam;
}

export function briefEigenaarAdres(eigenaar: BriefEigenaarIdentiteit) {
  return [
    eigenaar.adres?.trim(),
    [formatteerPostcode(eigenaar.postcode), eigenaar.plaats?.trim()].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');
}

/**
 * Koppel een opgeslagen brief alleen terug aan een eigenaar als de geadresseerde
 * ondubbelzinnig is. Naam + correspondentieadres heeft voorrang; naam alleen mag
 * uitsluitend als exact één eigenaar matcht.
 */
export function vindBriefEigenaar<T extends BriefEigenaarIdentiteit>(
  brief: AcquisitieBrief,
  eigenaren: T[],
): T | null {
  const doelNaam = normaliseerBriefEigenaarWaarde(brief.eigenaar_bedrijfsnaam || brief.eigenaar_naam);
  const doelAdres = normaliseerBriefEigenaarWaarde(brief.verzendadres);
  if (!doelNaam) return null;

  const naamMatches = eigenaren.filter(
    (eigenaar) => normaliseerBriefEigenaarWaarde(briefEigenaarNaam(eigenaar)) === doelNaam,
  );

  if (doelAdres) {
    const exact = naamMatches.filter(
      (eigenaar) => normaliseerBriefEigenaarWaarde(briefEigenaarAdres(eigenaar)) === doelAdres,
    );
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
  }

  return naamMatches.length === 1 ? naamMatches[0] : null;
}
