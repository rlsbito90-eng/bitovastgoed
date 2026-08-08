export interface AcquisitieRelatieBron {
  id: string;
  bedrijfsnaam?: string | null;
  contactpersoon?: string | null;
  vestigingsplaats?: string | null;
  softDeletedAt?: string | null;
}

export interface AcquisitieRelatieZoekcontext {
  eigenaarNaam?: string | null;
  plaats?: string | null;
}

export type AcquisitieRelatieMatchNiveau = 'exact' | 'waarschijnlijk' | 'mogelijk';

export interface AcquisitieRelatieMatch {
  relatieId: string;
  label: string;
  niveau: AcquisitieRelatieMatchNiveau;
  score: number;
  redenen: string[];
}

export interface AcquisitieRelatieMatchReadModel {
  zoeknaam: string | null;
  zoekplaats: string | null;
  matches: AcquisitieRelatieMatch[];
  exacteMatch: AcquisitieRelatieMatch | null;
  heeftEenduidigeExacteMatch: boolean;
  primaireActie: string;
  veiligheidsmelding: string;
}

const normaliseer = (waarde?: string | null): string =>
  (waarde ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const tokens = (waarde?: string | null): string[] =>
  normaliseer(waarde)
    .split(' ')
    .filter((token) => token.length >= 2);

const overlap = (links: string[], rechts: string[]): number => {
  if (!links.length || !rechts.length) return 0;
  const rechtsSet = new Set(rechts);
  const aantal = links.filter((token) => rechtsSet.has(token)).length;
  return aantal / Math.max(links.length, rechts.length);
};

const labelVoor = (relatie: AcquisitieRelatieBron): string =>
  relatie.bedrijfsnaam?.trim()
  || relatie.contactpersoon?.trim()
  || 'Naamloze relatie';

export function bouwAcquisitieRelatieMatchReadModel(
  context: AcquisitieRelatieZoekcontext,
  relaties: AcquisitieRelatieBron[],
): AcquisitieRelatieMatchReadModel {
  const zoeknaam = context.eigenaarNaam?.trim() || null;
  const zoekplaats = context.plaats?.trim() || null;
  const naamNorm = normaliseer(zoeknaam);
  const plaatsNorm = normaliseer(zoekplaats);
  const naamTokens = tokens(zoeknaam);

  const matches = relaties
    .filter((relatie) => !relatie.softDeletedAt)
    .map((relatie): AcquisitieRelatieMatch | null => {
      const bedrijfsnaamNorm = normaliseer(relatie.bedrijfsnaam);
      const contactpersoonNorm = normaliseer(relatie.contactpersoon);
      const relatiePlaatsNorm = normaliseer(relatie.vestigingsplaats);
      const bedrijfsOverlap = overlap(naamTokens, tokens(relatie.bedrijfsnaam));
      const contactOverlap = overlap(naamTokens, tokens(relatie.contactpersoon));
      const exactBedrijf = Boolean(naamNorm && bedrijfsnaamNorm === naamNorm);
      const exactContact = Boolean(naamNorm && contactpersoonNorm === naamNorm);
      const plaatsGelijk = Boolean(plaatsNorm && relatiePlaatsNorm === plaatsNorm);

      let score = 0;
      const redenen: string[] = [];

      if (exactBedrijf) {
        score += 100;
        redenen.push('Bedrijfsnaam komt exact overeen');
      } else if (exactContact) {
        score += 95;
        redenen.push('Contactpersoon komt exact overeen');
      } else {
        const besteOverlap = Math.max(bedrijfsOverlap, contactOverlap);
        if (besteOverlap >= 0.75) {
          score += 70;
          redenen.push('Naam komt grotendeels overeen');
        } else if (besteOverlap >= 0.5) {
          score += 45;
          redenen.push('Naam komt gedeeltelijk overeen');
        }
      }

      if (plaatsGelijk) {
        score += 15;
        redenen.push('Vestigingsplaats komt overeen');
      }

      if (score < 45) return null;

      const niveau: AcquisitieRelatieMatchNiveau =
        score >= 95 ? 'exact' : score >= 70 ? 'waarschijnlijk' : 'mogelijk';

      return {
        relatieId: relatie.id,
        label: labelVoor(relatie),
        niveau,
        score,
        redenen,
      };
    })
    .filter((match): match is AcquisitieRelatieMatch => Boolean(match))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'nl'));

  const exacteMatches = matches.filter((match) => match.niveau === 'exact');
  const heeftEenduidigeExacteMatch = exacteMatches.length === 1;
  const exacteMatch = heeftEenduidigeExacteMatch ? exacteMatches[0] : null;

  let primaireActie: string;
  if (!zoeknaam) primaireActie = 'Registreer eerst de gevonden eigenaar of rechthebbende';
  else if (heeftEenduidigeExacteMatch) primaireActie = 'Controleer en bevestig de bestaande CRM-relatie';
  else if (matches.length > 0) primaireActie = 'Beoordeel de mogelijke CRM-relaties';
  else primaireActie = 'Zoek een bestaande relatie of maak bewust een nieuwe relatie aan';

  return {
    zoeknaam,
    zoekplaats,
    matches,
    exacteMatch,
    heeftEenduidigeExacteMatch,
    primaireActie,
    veiligheidsmelding: 'Een naamovereenkomst koppelt nooit automatisch. De gebruiker moet de CRM-relatie altijd expliciet controleren en bevestigen.',
  };
}
