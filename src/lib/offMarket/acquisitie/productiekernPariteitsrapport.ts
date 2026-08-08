import type {
  ProductiekernDossierPariteitsmeting,
  ProductiekernPariteitsstatus,
} from './productiekernDossierPariteitsmeting';

export interface ProductiekernPariteitsrapportRegel {
  selectieId: string;
  meting: ProductiekernDossierPariteitsmeting;
}

export interface ProductiekernPariteitsrapport {
  totaal: number;
  aantallen: Record<ProductiekernPariteitsstatus, number>;
  kritiekeSelectieIds: string[];
  ontbrekendeSelectieIds: string[];
  veiligVoorReadOnlyProef: boolean;
}

const LEGE_AANTALLEN: Record<ProductiekernPariteitsstatus, number> = {
  niet_geactiveerd: 0,
  productiekern_dossier_ontbreekt: 0,
  gelijk: 0,
  procesafwijking: 0,
  kritieke_afwijking: 0,
};

/**
 * Vat losse read-only pariteitsmetingen samen tot één controleerbaar rapport.
 *
 * Een read-only proef geldt uitsluitend als veilig wanneer ten minste één
 * selectie is gemeten, alle metingen daadwerkelijk geactiveerd waren en geen
 * productiekern-dossiers of kritieke identiteiten ontbreken. Procesafwijkingen
 * blijven zichtbaar, maar blokkeren de read-only proef niet automatisch.
 */
export function bouwProductiekernPariteitsrapport(
  regels: readonly ProductiekernPariteitsrapportRegel[],
): ProductiekernPariteitsrapport {
  const aantallen = { ...LEGE_AANTALLEN };
  const kritiekeSelectieIds: string[] = [];
  const ontbrekendeSelectieIds: string[] = [];

  for (const regel of regels) {
    aantallen[regel.meting.status] += 1;

    if (regel.meting.status === 'kritieke_afwijking') {
      kritiekeSelectieIds.push(regel.selectieId);
    }
    if (regel.meting.status === 'productiekern_dossier_ontbreekt') {
      ontbrekendeSelectieIds.push(regel.selectieId);
    }
  }

  return {
    totaal: regels.length,
    aantallen,
    kritiekeSelectieIds,
    ontbrekendeSelectieIds,
    veiligVoorReadOnlyProef:
      regels.length > 0
      && aantallen.niet_geactiveerd === 0
      && aantallen.productiekern_dossier_ontbreekt === 0
      && aantallen.kritieke_afwijking === 0,
  };
}
