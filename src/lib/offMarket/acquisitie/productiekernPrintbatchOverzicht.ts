import type {
  BriefContract,
  BriefversieContract,
  PrintbatchBriefContract,
  PrintbatchContract,
} from './productiekernContract';
import { productiekernGeadresseerdeNaam } from './productiekernGeadresseerdeNaam';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export interface ProductiekernPrintbatchRegel {
  briefId: string;
  briefVersieId: string;
  briefnummer: string;
  signaalId: string;
  geadresseerde: string;
  objectLabel: string;
}

export interface ProductiekernPrintbatchModel {
  batch: PrintbatchContract;
  regels: ProductiekernPrintbatchRegel[];
  aantalSignalen: number;
}

export interface ProductieNummersVoorSignaal {
  briefnummers: string[];
  batchnummers: string[];
}

export function bouwProductiekernPrintbatchModellen(input: {
  batches: readonly PrintbatchContract[];
  koppelingen: readonly PrintbatchBriefContract[];
  brieven: readonly BriefContract[];
  versies: readonly BriefversieContract[];
  signalen: readonly OffMarketSignaal[];
}): ProductiekernPrintbatchModel[] {
  const briefIndex = new Map(input.brieven.map((brief) => [brief.id, brief] as const));
  const versieIndex = new Map(input.versies.map((versie) => [versie.id, versie] as const));
  const signaalIndex = new Map(input.signalen.map((signaal) => [signaal.id, signaal] as const));
  const koppelingenPerBatch = new Map<string, PrintbatchBriefContract[]>();
  for (const koppeling of input.koppelingen) {
    if (koppeling.verwijderdOp !== null) continue;
    const bestaand = koppelingenPerBatch.get(koppeling.batchId) ?? [];
    bestaand.push(koppeling);
    koppelingenPerBatch.set(koppeling.batchId, bestaand);
  }

  return [...input.batches]
    .sort((a, b) => b.batchnummer.localeCompare(a.batchnummer))
    .map((batch) => {
      const regels = (koppelingenPerBatch.get(batch.id) ?? [])
        .map((koppeling): ProductiekernPrintbatchRegel | null => {
          const brief = briefIndex.get(koppeling.briefId);
          const versie = versieIndex.get(koppeling.briefVersieId);
          if (!brief || !versie || !brief.briefnummer) return null;
          const signaal = signaalIndex.get(brief.signaalId);
          const adres = signaal?.adres?.trim() ?? versie.inhoud.objectadres?.trim() ?? '';
          const plaats = signaal?.plaats?.trim() ?? '';
          return {
            briefId: brief.id,
            briefVersieId: versie.id,
            briefnummer: brief.briefnummer,
            signaalId: brief.signaalId,
            geadresseerde: productiekernGeadresseerdeNaam(versie.geadresseerde),
            objectLabel: [adres, plaats].filter(Boolean).join(' · ') || 'Object niet benoemd',
          };
        })
        .filter((regel): regel is ProductiekernPrintbatchRegel => regel !== null)
        .sort((a, b) => a.briefnummer.localeCompare(b.briefnummer));

      return {
        batch,
        regels,
        aantalSignalen: new Set(regels.map((regel) => regel.signaalId)).size,
      };
    })
    .filter((model) => model.regels.length > 0);
}

export function indexeerProductieNummersPerSignaal(
  modellen: readonly ProductiekernPrintbatchModel[],
  formeleBrieven: readonly BriefContract[],
): Map<string, ProductieNummersVoorSignaal> {
  const index = new Map<string, { briefnummers: Set<string>; batchnummers: Set<string> }>();
  const pak = (signaalId: string) => {
    const bestaand = index.get(signaalId);
    if (bestaand) return bestaand;
    const nieuw = { briefnummers: new Set<string>(), batchnummers: new Set<string>() };
    index.set(signaalId, nieuw);
    return nieuw;
  };

  for (const brief of formeleBrieven) {
    if (brief.briefnummer) pak(brief.signaalId).briefnummers.add(brief.briefnummer);
  }
  for (const model of modellen) {
    for (const regel of model.regels) {
      const nummers = pak(regel.signaalId);
      nummers.briefnummers.add(regel.briefnummer);
      nummers.batchnummers.add(model.batch.batchnummer);
    }
  }

  return new Map([...index].map(([signaalId, nummers]) => [signaalId, {
    briefnummers: [...nummers.briefnummers].sort(),
    batchnummers: [...nummers.batchnummers].sort().reverse(),
  }]));
}
