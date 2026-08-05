import type { Vastgoedkans } from './vastgoedkansen';

export interface VastgoedkansOnderzoekModel {
  adres: string;
  mapsUrl: string | null;
  googleUrl: string | null;
  bagViewerUrl: string | null;
  kadastraleKaartUrl: string | null;
  bagPandId: string | null;
  bagVerblijfsobjectId: string | null;
  heeftBagKoppeling: boolean;
  kanNaarKadaster: boolean;
  herkomstLabel: string;
  score: number | null;
  scoreUitleg: string | null;
}

const schoon = (waarde: string | null | undefined): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

export function bouwVastgoedkansOnderzoekModel(
  kans: Pick<Vastgoedkans,
    | 'adres'
    | 'postcode'
    | 'plaats'
    | 'bagPandId'
    | 'bagVerblijfsobjectId'
    | 'herkomst'
    | 'herkomstReferentie'
    | 'algoritmeScore'
    | 'scoreUitleg'
  >,
): VastgoedkansOnderzoekModel {
  const adres = [schoon(kans.adres), schoon(kans.postcode), schoon(kans.plaats)]
    .filter((waarde): waarde is string => Boolean(waarde))
    .join(', ');
  const query = adres ? encodeURIComponent(adres) : null;
  const bagPandId = schoon(kans.bagPandId);
  const bagVerblijfsobjectId = schoon(kans.bagVerblijfsobjectId);
  const heeftBagKoppeling = Boolean(bagPandId || bagVerblijfsobjectId);

  return {
    adres,
    mapsUrl: query ? `https://www.google.com/maps/search/?api=1&query=${query}` : null,
    googleUrl: query ? `https://www.google.com/search?q=${query}` : null,
    bagViewerUrl: query ? `https://bagviewer.kadaster.nl/lvbag/bag-viewer/?searchQuery=${query}` : null,
    kadastraleKaartUrl: query ? `https://kadastralekaart.com/kaart?search=${query}` : null,
    bagPandId,
    bagVerblijfsobjectId,
    heeftBagKoppeling,
    kanNaarKadaster: heeftBagKoppeling || Boolean(adres),
    herkomstLabel: [kans.herkomst, schoon(kans.herkomstReferentie)].filter(Boolean).join(' · '),
    score: kans.algoritmeScore,
    scoreUitleg: schoon(kans.scoreUitleg),
  };
}
