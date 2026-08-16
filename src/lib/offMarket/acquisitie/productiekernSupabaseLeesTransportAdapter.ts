import { bouwProductiekernLeesAuditRecord, type ProductiekernLeesAuditRecord } from './productiekernSupabaseLeesAudit';
import { ProductiekernLeesBudgetOverschredenError } from './productiekernSupabaseLeesBudget';
import { normaliseerProductiekernLeesFout } from './productiekernSupabaseLeesFout';
import {
  bouwProductiekernBulkLeesQuery,
  bouwProductiekernLeesQuery,
  type ProductiekernBulkLeesQueryNaam,
  type ProductiekernLeesQueryNaam,
} from './productiekernSupabaseLeesQueryContract';
import type { ProductiekernSupabaseLeesTransport } from './productiekernSupabaseLeesRepository';

type SingleQueryNaam = Exclude<ProductiekernLeesQueryNaam, ProductiekernBulkLeesQueryNaam>;
type BulkQueryNaam = ProductiekernBulkLeesQueryNaam;

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
  voerBulkUit?(input: {
    tabel: string;
    selectKolommen: readonly string[];
    filterKolom: string;
    filterWaarden: readonly string[];
    maximaalAantalRecords: number;
  }): Promise<Record<string, unknown>[]>;
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

  function auditFout(query: ProductiekernLeesQueryNaam, gestart: number, error: unknown): never {
    const genormaliseerd = normaliseerProductiekernLeesFout(error);
    opties.audit?.(bouwProductiekernLeesAuditRecord({
      query,
      uitkomst: 'fout',
      duurMs: Math.max(0, klok() - gestart),
      foutcode: genormaliseerd.code,
    }));
    if (error instanceof ProductiekernLeesBudgetOverschredenError) throw error;
    throw new ProductiekernLeesTransportError(
      genormaliseerd.code,
      genormaliseerd.herstelbaar,
      genormaliseerd.publiekeMelding,
    );
  }

  async function voerQueryUit(
    queryNaam: SingleQueryNaam,
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
      if (aantalRecords > query.maximaalAantalRecords) throw { code: '21000' };
      opties.audit?.(bouwProductiekernLeesAuditRecord({
        query: queryNaam,
        uitkomst: Array.isArray(resultaat) ? 'lijst' : resultaat ? 'gevonden' : 'niet_gevonden',
        duurMs: Math.max(0, klok() - gestart),
        aantalRecords,
      }));
      return resultaat;
    } catch (error) {
      return auditFout(queryNaam, gestart, error);
    }
  }

  async function voerBulkQueryUit(
    queryNaam: BulkQueryNaam,
    filterWaarden: readonly string[],
  ): Promise<Record<string, unknown>[]> {
    const query = bouwProductiekernBulkLeesQuery(queryNaam, filterWaarden);
    if (!uitvoerder.voerBulkUit) {
      throw new Error(`Bulk-uitvoerder voor ${queryNaam} is niet aangesloten.`);
    }
    const gestart = klok();
    try {
      const resultaat = await uitvoerder.voerBulkUit({
        tabel: query.tabel,
        selectKolommen: query.selectKolommen,
        filterKolom: query.filterKolom,
        filterWaarden: query.filterWaarden,
        maximaalAantalRecords: query.maximaalAantalRecords,
      });
      if (!Array.isArray(resultaat) || resultaat.length > query.maximaalAantalRecords) {
        throw { code: '21000' };
      }
      opties.audit?.(bouwProductiekernLeesAuditRecord({
        query: queryNaam,
        uitkomst: 'lijst',
        duurMs: Math.max(0, klok() - gestart),
        aantalRecords: resultaat.length,
      }));
      return resultaat;
    } catch (error) {
      return auditFout(queryNaam, gestart, error);
    }
  }

  return {
    async haalEen(tabel, filters) {
      const mapping: Record<string, SingleQueryNaam> = {
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
      if (Array.isArray(resultaat)) throw new Error(`Cardinaliteitscontract voor ${queryNaam} wijkt af.`);
      return resultaat;
    },
    async haalMeerdere(tabel, filters, volgorde) {
      const mapping: Record<string, SingleQueryNaam> = {
        off_market_brief_versies: 'haal_briefversies',
        off_market_printbatch_brieven: 'haal_printbatch_brieven',
      };
      const queryNaam = mapping[tabel];
      if (!queryNaam) throw new Error(`Niet-toegestane productiekernleestabel: ${tabel}.`);
      const query = bouwProductiekernLeesQuery(queryNaam, Object.values(filters)[0] ?? '');
      if (Object.keys(filters).length !== 1 || !(query.filterKolom in filters)) {
        throw new Error(`Filtercontract voor ${queryNaam} wijkt af.`);
      }
      if (JSON.stringify(volgorde) !== JSON.stringify(query.volgorde)) {
        throw new Error(`Volgordecontract voor ${queryNaam} wijkt af.`);
      }
      const resultaat = await voerQueryUit(queryNaam, query.filterWaarde);
      if (!Array.isArray(resultaat)) throw new Error(`Cardinaliteitscontract voor ${queryNaam} wijkt af.`);
      return resultaat;
    },
    async haalMeerdereOpIds(tabel, ids) {
      const mapping: Record<string, BulkQueryNaam> = {
        off_market_acquisitie_dossiers: 'haal_dossiers_op_selectie_ids',
        off_market_brieven: 'haal_brieven_op_ids',
        off_market_brief_versies: 'haal_briefversies_op_ids',
        off_market_printbatch_brieven: 'haal_printbatch_brieven_op_versie_ids',
      };
      const queryNaam = mapping[tabel];
      if (!queryNaam) throw new Error(`Niet-toegestane productiekern-bulkleestabel: ${tabel}.`);
      return voerBulkQueryUit(queryNaam, ids);
    },
  };
}
