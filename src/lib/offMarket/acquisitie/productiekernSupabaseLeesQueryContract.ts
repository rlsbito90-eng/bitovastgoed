export type ProductiekernLeesQueryNaam =
  | 'haal_dossier'
  | 'haal_brief'
  | 'haal_briefversies'
  | 'haal_printbatch'
  | 'haal_printbatch_brieven'
  | 'haal_brieven_op_ids'
  | 'haal_briefversies_op_ids';

export interface ProductiekernLeesQueryContract {
  naam: ProductiekernLeesQueryNaam;
  tabel: string;
  filterKolom: string;
  selectKolommen: readonly string[];
  volgorde?: Readonly<{ kolom: string; oplopend: boolean }>;
  cardinaliteit: 'nul_of_een' | 'lijst';
  maximaalAantalRecords: number;
}

export interface ProductiekernBulkLeesQueryContract extends ProductiekernLeesQueryContract {
  cardinaliteit: 'lijst';
  maximaalAantalFilterwaarden: number;
}

const BRIEF_KOLOMMEN = [
  'id', 'briefnummer', 'signaal_id', 'selectie_id', 'object_id',
  'relatie_id', 'actieve_versie', 'status', 'vervanging_van_brief_id',
  'definitief_op', 'vergrendeld_op', 'annuleringsreden',
] as const;

const BRIEFVERSIE_KOLOMMEN = [
  'id', 'brief_id', 'versienummer', 'status', 'inhoud_snapshot',
  'geadresseerde_snapshot', 'bestand_referentie', 'created_at',
  'vervallen_op', 'verzonden_op',
] as const;

export const PRODUCTIEKERN_LEES_QUERY_CONTRACTEN: Readonly<
  Record<Exclude<ProductiekernLeesQueryNaam, 'haal_brieven_op_ids' | 'haal_briefversies_op_ids'>, ProductiekernLeesQueryContract>
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
    maximaalAantalRecords: 1,
  },
  haal_brief: {
    naam: 'haal_brief',
    tabel: 'off_market_brieven',
    filterKolom: 'id',
    selectKolommen: BRIEF_KOLOMMEN,
    cardinaliteit: 'nul_of_een',
    maximaalAantalRecords: 1,
  },
  haal_briefversies: {
    naam: 'haal_briefversies',
    tabel: 'off_market_brief_versies',
    filterKolom: 'brief_id',
    selectKolommen: BRIEFVERSIE_KOLOMMEN,
    volgorde: { kolom: 'versienummer', oplopend: true },
    cardinaliteit: 'lijst',
    maximaalAantalRecords: 100,
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
    maximaalAantalRecords: 1,
  },
  haal_printbatch_brieven: {
    naam: 'haal_printbatch_brieven',
    tabel: 'off_market_printbatch_brieven',
    filterKolom: 'batch_id',
    selectKolommen: [
      'id', 'batch_id', 'brief_id', 'brief_versie_id', 'verwijderd_op',
      'afwijkingsstatus', 'afwijkingsreden', 'created_at',
    ],
    volgorde: { kolom: 'created_at', oplopend: true },
    cardinaliteit: 'lijst',
    maximaalAantalRecords: 1000,
  },
};

export const PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN: Readonly<
  Record<'haal_brieven_op_ids' | 'haal_briefversies_op_ids', ProductiekernBulkLeesQueryContract>
> = {
  haal_brieven_op_ids: {
    naam: 'haal_brieven_op_ids',
    tabel: 'off_market_brieven',
    filterKolom: 'id',
    selectKolommen: BRIEF_KOLOMMEN,
    cardinaliteit: 'lijst',
    maximaalAantalRecords: 1000,
    maximaalAantalFilterwaarden: 1000,
  },
  haal_briefversies_op_ids: {
    naam: 'haal_briefversies_op_ids',
    tabel: 'off_market_brief_versies',
    filterKolom: 'id',
    selectKolommen: BRIEFVERSIE_KOLOMMEN,
    cardinaliteit: 'lijst',
    maximaalAantalRecords: 1000,
    maximaalAantalFilterwaarden: 1000,
  },
};

function normaliseerFilterwaarde(naam: ProductiekernLeesQueryNaam, waarde: string): string {
  const genormaliseerd = waarde.trim();
  if (!genormaliseerd) throw new Error(`Filterwaarde voor ${naam} is verplicht.`);
  if (genormaliseerd.length > 200) throw new Error(`Filterwaarde voor ${naam} is te lang.`);
  if (/[\u0000-\u001f\u007f]/u.test(genormaliseerd)) {
    throw new Error(`Filterwaarde voor ${naam} bevat controletekens.`);
  }
  return genormaliseerd;
}

export function bouwProductiekernLeesQuery(
  naam: Exclude<ProductiekernLeesQueryNaam, 'haal_brieven_op_ids' | 'haal_briefversies_op_ids'>,
  filterWaarde: string,
): ProductiekernLeesQueryContract & { filterWaarde: string } {
  const genormaliseerd = normaliseerFilterwaarde(naam, filterWaarde);
  return {
    ...PRODUCTIEKERN_LEES_QUERY_CONTRACTEN[naam],
    filterWaarde: genormaliseerd,
  };
}

export function bouwProductiekernBulkLeesQuery(
  naam: 'haal_brieven_op_ids' | 'haal_briefversies_op_ids',
  filterWaarden: readonly string[],
): ProductiekernBulkLeesQueryContract & { filterWaarden: readonly string[] } {
  const contract = PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN[naam];
  if (filterWaarden.length === 0) throw new Error(`Filterwaarden voor ${naam} zijn verplicht.`);
  const uniek = [...new Set(filterWaarden.map((waarde) => normaliseerFilterwaarde(naam, waarde)))];
  if (uniek.length > contract.maximaalAantalFilterwaarden) {
    throw new Error(`Te veel filterwaarden voor ${naam}.`);
  }
  return { ...contract, filterWaarden: Object.freeze(uniek) };
}
