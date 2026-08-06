export type ProductiekernLeesQueryNaam =
  | 'haal_dossier'
  | 'haal_brief'
  | 'haal_briefversies'
  | 'haal_printbatch';

export interface ProductiekernLeesQueryContract {
  naam: ProductiekernLeesQueryNaam;
  tabel: string;
  filterKolom: string;
  selectKolommen: readonly string[];
  volgorde?: Readonly<{ kolom: string; oplopend: boolean }>;
  cardinaliteit: 'nul_of_een' | 'lijst';
}

export const PRODUCTIEKERN_LEES_QUERY_CONTRACTEN: Readonly<
  Record<ProductiekernLeesQueryNaam, ProductiekernLeesQueryContract>
> = {
  haal_dossier: {
    naam: 'haal_dossier',
    tabel: 'off_market_acquisitie_dossiers',
    filterKolom: 'selectie_id',
    selectKolommen: [
      'selectie_id', 'signaal_id', 'object_id', 'verwerking_gestart_op',
      'verwerking_gestart_door', 'primaire_werkbak', 'volgende_actie_op',
      'volgende_actie_omschrijving',
    ],
    cardinaliteit: 'nul_of_een',
  },
  haal_brief: {
    naam: 'haal_brief',
    tabel: 'off_market_brieven',
    filterKolom: 'id',
    selectKolommen: [
      'id', 'briefnummer', 'signaal_id', 'selectie_id', 'object_id',
      'relatie_id', 'actieve_versie', 'status', 'vervanging_van_brief_id',
      'definitief_op', 'vergrendeld_op', 'annuleringsreden',
    ],
    cardinaliteit: 'nul_of_een',
  },
  haal_briefversies: {
    naam: 'haal_briefversies',
    tabel: 'off_market_brief_versies',
    filterKolom: 'brief_id',
    selectKolommen: [
      'id', 'brief_id', 'versienummer', 'status', 'inhoud_snapshot',
      'geadresseerde_snapshot', 'bestand_referentie', 'created_at',
      'vervallen_op', 'verzonden_op',
    ],
    volgorde: { kolom: 'versienummer', oplopend: true },
    cardinaliteit: 'lijst',
  },
  haal_printbatch: {
    naam: 'haal_printbatch',
    tabel: 'off_market_printbatches',
    filterKolom: 'id',
    selectKolommen: [
      'id', 'batchnummer', 'status', 'documentversie',
      'aanvulling_op_batch_id', 'printdatum', 'verzenddatum',
      'geannuleerd_op', 'annuleringsreden',
    ],
    cardinaliteit: 'nul_of_een',
  },
};

export function bouwProductiekernLeesQuery(
  naam: ProductiekernLeesQueryNaam,
  filterWaarde: string,
): ProductiekernLeesQueryContract & { filterWaarde: string } {
  const genormaliseerd = filterWaarde.trim();
  if (!genormaliseerd) {
    throw new Error(`Filterwaarde voor ${naam} is verplicht.`);
  }
  if (genormaliseerd.length > 200) {
    throw new Error(`Filterwaarde voor ${naam} is te lang.`);
  }
  if(/[\u0000-\u001f\u007f]/u.test(genormaliseerd)) {
    throw new Error(`Filterwaarde voor ${naam} bevat controletekens.`);
  }
  return {
    ...PRODUCTIEKERN_LEES_QUERY_CONTRACTEN[naam],
    filterWaarde: genormaliseerd,
  };
}
