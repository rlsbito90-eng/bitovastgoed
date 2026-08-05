import type { AcquisitieDossierContext } from './acquisitieDossierContext';

export type AcquisitieEigenaarStatus =
  | 'niet_gestart'
  | 'onderzoek_lopend'
  | 'gevonden'
  | 'benaderd'
  | 'onbekend';

export interface AcquisitieEigenaarWerkstroomInput {
  dossier: AcquisitieDossierContext;
  status?: string | null;
  eigenaarNaam?: string | null;
  eigenaarBron?: string | null;
  kadastraleAanduiding?: string | null;
  laatstGecontroleerdOp?: string | null;
}

export interface AcquisitieEigenaarWerkstroomModel {
  dossier: AcquisitieDossierContext;
  status: AcquisitieEigenaarStatus;
  eigenaarNaam: string | null;
  eigenaarBron: string | null;
  kadastraleAanduiding: string | null;
  laatstGecontroleerdOp: string | null;
  heeftEigenaar: boolean;
  heeftRelatiekoppeling: boolean;
  kanEigenaarZoeken: boolean;
  kanRelatieKoppelen: boolean;
  kanBriefVoorbereiden: boolean;
}

const schoon = (waarde: string | null | undefined): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

const STATUSSEN = new Set<AcquisitieEigenaarStatus>([
  'niet_gestart',
  'onderzoek_lopend',
  'gevonden',
  'benaderd',
  'onbekend',
]);

export function normaliseerAcquisitieEigenaarStatus(
  status: string | null | undefined,
): AcquisitieEigenaarStatus {
  const waarde = schoon(status) as AcquisitieEigenaarStatus | null;
  return waarde && STATUSSEN.has(waarde) ? waarde : 'niet_gestart';
}

export function bouwAcquisitieEigenaarWerkstroomModel(
  input: AcquisitieEigenaarWerkstroomInput,
): AcquisitieEigenaarWerkstroomModel {
  const eigenaarNaam = schoon(input.eigenaarNaam);
  const eigenaarBron = schoon(input.eigenaarBron);
  const kadastraleAanduiding = schoon(input.kadastraleAanduiding);
  const laatstGecontroleerdOp = schoon(input.laatstGecontroleerdOp);
  const heeftRelatiekoppeling = Boolean(input.dossier.eigenaarRelatieId);
  const heeftEigenaar = Boolean(eigenaarNaam || heeftRelatiekoppeling);

  return {
    dossier: input.dossier,
    status: normaliseerAcquisitieEigenaarStatus(input.status),
    eigenaarNaam,
    eigenaarBron,
    kadastraleAanduiding,
    laatstGecontroleerdOp,
    heeftEigenaar,
    heeftRelatiekoppeling,
    kanEigenaarZoeken: Boolean(input.dossier.adres),
    kanRelatieKoppelen: heeftEigenaar,
    kanBriefVoorbereiden: heeftEigenaar,
  };
}
