export interface GoogleMapsAdres {
  adres: string;
  postcode?: string | null;
  plaats?: string | null;
}

export function bouwGoogleMapsAdresZoekterm({ adres, postcode, plaats }: GoogleMapsAdres): string {
  return [adres, postcode, plaats]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(', ');
}

export function bouwGoogleMapsAdresUrl(adres: GoogleMapsAdres): string {
  const query = bouwGoogleMapsAdresZoekterm(adres);
  const params = new URLSearchParams({ api: '1', query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
