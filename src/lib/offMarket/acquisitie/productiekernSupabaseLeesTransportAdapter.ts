import { bouwProductiekernLeesAuditRecord, type ProductiekernLeesAuditRecord } from './productiekernSupabaseLeesAudit';
import { normaliseerProductiekernLeesFout } from './productiekernSupabaseLeesFout';
import { bouwProductiekernLeesQuery, type ProductiekernLeesQueryNaam } from './productiekernSupabaseLeesQueryContract';
import type { ProductiekernSupabaseLeesTransport } from './productiekernSupabaseLeesRepository';

export interface ProductiekernSupabaseQueryUitvoerder {
  voerUit(input: {
    tabel: string;
    selectKolommen: readonly string[];
    filterKolom: string;
    filterWaarde: string;
    cardinaliteit: 'nul_of_een' | 'lijst';
    maximaalAantalRecords: number;
    volgorde?: Readonly<{ kolom: string; oplopend: boolean }>;
  }): Promise<Record<string, unknown> | Record<string, unknown>[] | null>;
}

export interface ProductiekernLeesTransportOpties {
  audit?: (record: ProductiekernLeesAuditRecord) => void;
  klok?: () => number;
}

export class ProductiekernLeesTransportError extends Error {
  constructor(
    readonly code: ReturnType<typeof normaliseerProductiekernLeesFout>['code'],
    readonly herstelbaar: boolean,
    publiekeMelding: string,
  ) {
    super(publiekeMelding);
    this.name = 'ProductiekernLeesTransportError';
  }
}

export function maakProductiekernSupabaseLeesTransport(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernLeesTransportOpties = {},
): ProductiekernSupabaseLeesTransport {
  const klok = opties.klok ?? (() => Date.now());

  async function voerQueryUit(
    queryNaam: ProductiekernLeesQueryNaam,
    filterWaarde: string,
  ): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
    const query = bouwProductiekernLeesQuery(queryNaam, filterWaarde);
    const gestart = klok();
    try {
      const resultaat = await uitvoerder.voerUit({
        tabel: query.tabel,
        selectKolommen: query.selectKolommen,
        filterKolom: query.filterKolom,
        filterWaarde: query.filterWaarde,
        cardinaliteit: query.cardinaliteit,
        maximaalAantalRecords: query.maximaalAantalRecords,
        volgorde: query.volgorde,
      });
      const aantalRecords = Array.isArray(resultaat) ? resultaat.length : resultaat ? 1 : 0;
      if (aantalRecords > query.maximaalAantalRecords) {
        throw { code: '21000' };
      }
      opties.audit?.(bouwProductiekernLeesAuditRecord({
        query: queryNaam,
        uitkomst: Array.isArray(resultaat)
          ? 'lijst'
          : resultaat
            ? 'gevonden'
            : 'niet_gevonden',
        duurMs: Math.max(0, klok() - gestart),
        aantalRecords,
      }));
      return resultaat;
    } catch (error) {
      const genormaliseerd = normaliseerProductiekernLeesFout(error);
      opties.audit?.(bouwProductiekernLeesAuditRecord({
        query: queryNaam,
        uitkomst: 'fout',
        duurMs: Math.max(0, klok() - gestart),
        foutcode: genormaliseerd.code,
      }));
      throw new ProductiekernLeesTransportError(
        genormaliseerd.code,
        genormaliseerd.herstelbaar,
        genormaliseerd.publiekeMelding,
      );
    }
  }

  return {
    async haalEen(tabel, filters) {
      const mapping: Record<string, ProductiekernLeesQueryNaam> = {
        off_market_acquisitie_dossiers: 'haal_dossier',
        off_market_brieven: 'haal_brief',
        off_market_printbatches: 'haal_printbatch',
      };
      const queryNaam = mapping[tabel];
      if (!queryNaam) throw new Error(`Niet-toegestane productiekernleestabel: ${tabel}.`);
      const query = bouwProductiekernLeesQuery(queryNaam, Object.values(filters)[0] ?? '');
      if (Object.keys(filters).length !== 1 || !(query.filterKolom in filters)) {
        throw new Error(`Filtercontract voor ${queryNaam} wijkt af.`);
      }
      const resultaat = await voerQueryUit(queryNaam, query.filterWaarde);
      if (Array.isArray(resultaat)) {
        throw new Error(`Cardinaliteitscontract voor ${queryNaam} wijkt af.`);
      }
      return resultaat;
    },
    async haalMeerdere(tabel, filters, volgorde) {
      if (tabel !== 'off_market_brief_versies') {
        throw new Error(`Niet-toegestane productiekernleestabel: ${tabel}.`);
      }
      const query = bouwProductiekernLeesQuery(
        'haal_briefversies',
        Object.values(filters)[0] ?? '',
      );
      if (Object.keys(filters).length !== 1 || !(query.filterKolom in filters)) {
        throw new Error('Filtercontract voor haal_briefversies wijkt af.');
      }
      if (JSON.stringify(volgorde) !== JSON.stringify(query.volgorde)) {
        throw new Error('Volgordecontract voor haal_briefversies wijkt af.');
      }
      const resultaat = await voerQueryUit('haal_briefversies', query.filterWaarde);
      if (!Array.isArray(resultaat)) {
        throw new Error('Cardinaliteitscontract voor haal_briefversies wijkt af.');
      }
      return resultaat;
    },
  };
}
