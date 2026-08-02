export interface AdresInput {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}

export interface GenormaliseerdAdres {
  adres: string;
  postcode: string;
  plaats: string;
  sleutel: string;
  volledig: boolean;
}

const DIACRITICS = /[\u0300-\u036f]/g;

export function normaliseerTekst(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[.,;:()\[\]{}]/g, ' ')
    .replace(/[-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseerPostcode(value?: string | null): string {
  return (value ?? '').toUpperCase().replace(/\s+/g, '').trim();
}

export function normaliseerAdres(input: AdresInput): GenormaliseerdAdres {
  const adres = normaliseerTekst(input.adres);
  const postcode = normaliseerPostcode(input.postcode);
  const plaats = normaliseerTekst(input.plaats);
  const onderdelen = [postcode, adres, plaats].filter(Boolean);

  return {
    adres,
    postcode,
    plaats,
    sleutel: onderdelen.join('|'),
    volledig: Boolean(adres && postcode && plaats),
  };
}

export function adressenZijnGelijk(a: AdresInput, b: AdresInput): boolean {
  const links = normaliseerAdres(a);
  const rechts = normaliseerAdres(b);
  return Boolean(links.sleutel && links.sleutel === rechts.sleutel);
}
