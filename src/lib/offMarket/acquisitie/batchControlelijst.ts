import type { BriefversieContract, PrintbatchContract } from './productiekernContract';
import { valideerBriefversie, valideerPrintbatch } from './productiekernContract';

export interface BatchControleInvoer {
  briefnummer: string;
  versie: BriefversieContract;
}

export interface BatchControleRij {
  volgnummer: number;
  briefnummer: string;
  briefVersieId: string;
  geadresseerde: string;
  plaats: string;
  adresGeverifieerd: boolean;
  pdfBeschikbaar: boolean;
  pdfBron: 'opgeslagen_bestand' | 'immutable_snapshot';
}

export interface BatchControlelijst {
  batchId: string;
  batchnummer: string;
  documentversie: number;
  totaal: number;
  nietGeverifieerd: number;
  pdfOntbreekt: number;
  rijen: BatchControleRij[];
}

/**
 * De Productiekern hoeft geen individuele PDF per brief vooraf op te slaan.
 * Een geldige actieve immutable briefversie + BR-nummer is zelf de canonieke
 * renderbron. `bestandReferentie` blijft bruikbaar voor reeds opgeslagen legacy-
 * of voorgerenderde PDF's, maar null is geen blokkade voor batchproductie.
 */
export function bouwBatchControlelijst(input: {
  batch: PrintbatchContract;
  brieven: readonly BatchControleInvoer[];
}): BatchControlelijst {
  const batchFouten = valideerPrintbatch(input.batch);
  if (batchFouten.length > 0) throw new Error(`Ongeldige printbatch: ${batchFouten.join(' ')}`);
  if (input.brieven.length === 0) throw new Error('Controlelijst vereist minimaal één brief.');

  const nummers = new Set<string>();
  const versieIds = new Set<string>();
  const rijen = [...input.brieven]
    .sort((a, b) => a.briefnummer.localeCompare(b.briefnummer))
    .map((item, index): BatchControleRij => {
      const fouten = valideerBriefversie(item.versie);
      if (fouten.length > 0) throw new Error(`Ongeldige briefversie ${item.versie.id}: ${fouten.join(' ')}`);
      if (item.versie.status !== 'actief') throw new Error(`Briefversie ${item.versie.id} is niet actief.`);
      if (!item.briefnummer.trim()) throw new Error(`Briefnummer ontbreekt voor ${item.versie.id}.`);
      if (nummers.has(item.briefnummer)) throw new Error(`Briefnummer dubbel in controlelijst: ${item.briefnummer}.`);
      if (versieIds.has(item.versie.id)) throw new Error(`Briefversie dubbel in controlelijst: ${item.versie.id}.`);
      nummers.add(item.briefnummer);
      versieIds.add(item.versie.id);

      const opgeslagenPdf = Boolean(item.versie.bestandReferentie?.trim());
      return {
        volgnummer: index + 1,
        briefnummer: item.briefnummer,
        briefVersieId: item.versie.id,
        geadresseerde: item.versie.geadresseerde.bedrijfsnaam?.trim()
          || item.versie.geadresseerde.naam?.trim()
          || '',
        plaats: item.versie.geadresseerde.plaats.trim(),
        adresGeverifieerd: item.versie.geadresseerde.verificatiestatus !== 'onbekend',
        // Na de validaties hierboven is de immutable snapshot deterministisch renderbaar.
        pdfBeschikbaar: true,
        pdfBron: opgeslagenPdf ? 'opgeslagen_bestand' : 'immutable_snapshot',
      };
    });

  return {
    batchId: input.batch.id,
    batchnummer: input.batch.batchnummer,
    documentversie: input.batch.documentversie,
    totaal: rijen.length,
    nietGeverifieerd: rijen.filter((rij) => !rij.adresGeverifieerd).length,
    pdfOntbreekt: rijen.filter((rij) => !rij.pdfBeschikbaar).length,
    rijen,
  };
}
