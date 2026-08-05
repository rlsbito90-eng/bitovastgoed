import type { BagMatchKandidaat, BagStatus, BagVbo } from '@/lib/offMarket/bag/types';

export interface AcquisitieBagBronInput {
  bag_status?: string | null;
  bag_match_kwaliteit?: string | null;
  bag_aantal_vbo?: number | null;
  bag_aantal_panden?: number | null;
  bag_totaal_oppervlakte_m2?: number | null;
  bag_gebruiksdoelen?: string[] | null;
  bag_bouwjaar?: number | null;
  bag_pand_status?: string | null;
  bag_vbos?: BagVbo[] | null;
  bag_match_kandidaten?: BagMatchKandidaat[] | null;
  bag_geselecteerd_vbo_id?: string | null;
  bag_geselecteerd_nummeraanduiding_id?: string | null;
  bag_geselecteerd_pand_id?: string | null;
  bag_geselecteerd_adres?: string | null;
  bag_geselecteerd_opp_m2?: number | null;
  bag_geselecteerd_gebruiksdoel?: string[] | null;
  bag_pandcontext_aantal_vbo?: number | null;
  bag_pandcontext_totaal_opp_m2?: number | null;
  bag_pandcontext_incompleet?: boolean | null;
  bag_pandcontext_bron?: string | null;
  bag_foutmelding?: string | null;
}

export interface AcquisitieBagContext {
  status: BagStatus;
  matchKwaliteit: string | null;
  doelobject: BagVbo | null;
  doelAdres: string | null;
  doelVboId: string | null;
  doelNummeraanduidingId: string | null;
  doelPandId: string | null;
  doelOppervlakteM2: number | null;
  doelGebruiksdoelen: string[];
  aantalVbos: number | null;
  aantalPanden: number | null;
  totaalOppervlakteM2: number | null;
  gebruiksdoelen: string[];
  bouwjaar: number | null;
  pandStatus: string | null;
  vbos: BagVbo[];
  kandidaten: BagMatchKandidaat[];
  pandcontextIncompleet: boolean;
  pandcontextBron: string | null;
  foutmelding: string | null;
  heeftGeldigeMatch: boolean;
  vereistMatchkeuze: boolean;
}

const BAG_STATUSSEN = new Set<BagStatus>([
  'niet_verrijkt', 'bezig', 'verrijkt', 'geen_match', 'meerdere_matches', 'fout',
]);

const schoon = (waarde: string | null | undefined): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

function statusVan(waarde: string | null | undefined): BagStatus {
  const kandidaat = schoon(waarde) as BagStatus | null;
  return kandidaat && BAG_STATUSSEN.has(kandidaat) ? kandidaat : 'niet_verrijkt';
}

export function bouwAcquisitieBagContext(input: AcquisitieBagBronInput): AcquisitieBagContext {
  const vbos = Array.isArray(input.bag_vbos) ? input.bag_vbos : [];
  const kandidaten = Array.isArray(input.bag_match_kandidaten) ? input.bag_match_kandidaten : [];
  const doelVboId = schoon(input.bag_geselecteerd_vbo_id);
  const doelNummeraanduidingId = schoon(input.bag_geselecteerd_nummeraanduiding_id);
  const doelobject = vbos.find((vbo) =>
    vbo.is_doelobject === true ||
    Boolean(doelVboId && vbo.vbo_id === doelVboId) ||
    Boolean(doelNummeraanduidingId && vbo.nummeraanduiding_id === doelNummeraanduidingId)
  ) ?? null;
  const status = statusVan(input.bag_status);
  const doelAdres = schoon(input.bag_geselecteerd_adres) ?? schoon(doelobject?.adres);
  const doelOppervlakteM2 = input.bag_geselecteerd_opp_m2 ?? doelobject?.opp_m2 ?? null;
  const doelGebruiksdoelen = input.bag_geselecteerd_gebruiksdoel?.length
    ? input.bag_geselecteerd_gebruiksdoel
    : doelobject?.gebruiksdoel ?? [];
  const matchKwaliteit = schoon(input.bag_match_kwaliteit);
  const vereistMatchkeuze = status === 'meerdere_matches' || matchKwaliteit === 'onzeker';
  const heeftGeldigeMatch = status === 'verrijkt' && Boolean(doelAdres || doelVboId || doelobject);

  return {
    status,
    matchKwaliteit,
    doelobject,
    doelAdres,
    doelVboId: doelVboId ?? schoon(doelobject?.vbo_id),
    doelNummeraanduidingId: doelNummeraanduidingId ?? schoon(doelobject?.nummeraanduiding_id),
    doelPandId: schoon(input.bag_geselecteerd_pand_id) ?? schoon(doelobject?.pandid),
    doelOppervlakteM2,
    doelGebruiksdoelen,
    aantalVbos: input.bag_pandcontext_aantal_vbo ?? input.bag_aantal_vbo ?? null,
    aantalPanden: input.bag_aantal_panden ?? null,
    totaalOppervlakteM2: input.bag_pandcontext_totaal_opp_m2 ?? input.bag_totaal_oppervlakte_m2 ?? null,
    gebruiksdoelen: input.bag_gebruiksdoelen ?? [],
    bouwjaar: input.bag_bouwjaar ?? doelobject?.pand_bouwjaar ?? null,
    pandStatus: schoon(input.bag_pand_status) ?? schoon(doelobject?.pand_status),
    vbos,
    kandidaten,
    pandcontextIncompleet: input.bag_pandcontext_incompleet === true,
    pandcontextBron: schoon(input.bag_pandcontext_bron),
    foutmelding: schoon(input.bag_foutmelding),
    heeftGeldigeMatch,
    vereistMatchkeuze,
  };
}
