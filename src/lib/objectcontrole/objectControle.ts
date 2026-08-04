export type ObjectBronType = 'vastgoedkans' | 'object' | 'off_market_signaal';

export interface ObjectControleBronrecord {
  bronType: ObjectBronType;
  id: string;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  bagPandId?: string | null;
  bagVerblijfsobjectId?: string | null;
  status?: string | null;
  titel?: string | null;
}

export interface ObjectControleVraag {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  bagPandId?: string | null;
  bagVerblijfsobjectId?: string | null;
}

export type ObjectMatchSterkte = 'bag_verblijfsobject' | 'bag_pand' | 'adres';

export interface ObjectControleMatch {
  bronType: ObjectBronType;
  bronId: string;
  sterkte: ObjectMatchSterkte;
  status?: string | null;
  titel?: string | null;
}

export interface ObjectControleResultaat {
  bestaand: boolean;
  primaireMatch: ObjectControleMatch | null;
  matches: ObjectControleMatch[];
  heeftVastgoedkans: boolean;
  heeftObject: boolean;
  heeftOffMarketSignaal: boolean;
  aanbevolenActie: 'open_vastgoedkans' | 'open_object' | 'bekijk_signalen' | 'start_vastgoedkans';
}

const bronPrioriteit: Record<ObjectBronType, number> = {
  vastgoedkans: 1,
  object: 2,
  off_market_signaal: 3,
};

const sterktePrioriteit: Record<ObjectMatchSterkte, number> = {
  bag_verblijfsobject: 1,
  bag_pand: 2,
  adres: 3,
};

export function normaliseerObjectAdres(
  adres?: string | null,
  postcode?: string | null,
  plaats?: string | null,
): string | null {
  const delen = [adres, postcode, plaats]
    .map(value => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
  if (delen.length < 2) return null;
  return delen.join('|').replace(/\s+/g, '').replace(/[^a-z0-9|]/g, '');
}

function bepaalSterkte(vraag: ObjectControleVraag, record: ObjectControleBronrecord): ObjectMatchSterkte | null {
  if (vraag.bagVerblijfsobjectId && record.bagVerblijfsobjectId
    && vraag.bagVerblijfsobjectId === record.bagVerblijfsobjectId) return 'bag_verblijfsobject';
  if (vraag.bagPandId && record.bagPandId && vraag.bagPandId === record.bagPandId) return 'bag_pand';
  const vraagAdres = normaliseerObjectAdres(vraag.adres, vraag.postcode, vraag.plaats);
  const recordAdres = normaliseerObjectAdres(record.adres, record.postcode, record.plaats);
  return vraagAdres && recordAdres && vraagAdres === recordAdres ? 'adres' : null;
}

export function controleerObjectCrmBreed(
  vraag: ObjectControleVraag,
  records: ObjectControleBronrecord[],
): ObjectControleResultaat {
  const matches = records.flatMap<ObjectControleMatch>(record => {
    const sterkte = bepaalSterkte(vraag, record);
    return sterkte ? [{
      bronType: record.bronType,
      bronId: record.id,
      sterkte,
      status: record.status,
      titel: record.titel,
    }] : [];
  }).sort((a, b) =>
    sterktePrioriteit[a.sterkte] - sterktePrioriteit[b.sterkte]
    || bronPrioriteit[a.bronType] - bronPrioriteit[b.bronType]
    || a.bronId.localeCompare(b.bronId));

  const heeftVastgoedkans = matches.some(match => match.bronType === 'vastgoedkans');
  const heeftObject = matches.some(match => match.bronType === 'object');
  const heeftOffMarketSignaal = matches.some(match => match.bronType === 'off_market_signaal');

  const aanbevolenActie = heeftVastgoedkans
    ? 'open_vastgoedkans'
    : heeftObject
      ? 'open_object'
      : heeftOffMarketSignaal
        ? 'bekijk_signalen'
        : 'start_vastgoedkans';

  return {
    bestaand: matches.length > 0,
    primaireMatch: matches[0] ?? null,
    matches,
    heeftVastgoedkans,
    heeftObject,
    heeftOffMarketSignaal,
    aanbevolenActie,
  };
}
