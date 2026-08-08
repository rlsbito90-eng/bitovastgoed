import type { AcquisitiedossierContract } from './productiekernContract';
import type { OperationeleWerkbak } from './operationeleWerkbak';
import type { WerkbakContext } from './werkbak';

export interface ProductiekernWorkflowPariteit {
  totaalSelecties: number;
  vergelijkbaar: number;
  gelijk: number;
  afwijkend: number;
  legacyOntbreekt: number;
  productiekernOntbreekt: number;
}

/**
 * Zet de bestaande legacy-werkbakcontext om naar de dichtstbijzijnde formele
 * operationele werkbak. Dit is uitsluitend bedoeld voor observatie/pariteit;
 * de mapping mag nooit worden gebruikt om productiekernstatus terug te schrijven.
 */
export function mapLegacyWerkbakNaarOperationeleWerkbak(
  context: WerkbakContext,
): OperationeleWerkbak {
  if (context.werkbak === 'wachten') return 'wachten';
  if (context.werkbak === 'afgehandeld') return 'afgehandeld';

  switch (context.actieCategorie) {
    case 'opvolging_verlopen':
    case 'opvolging_vandaag':
    case 'opvolging_plannen':
      return 'opvolgen';
    case 'geprint_nog_posten':
      return 'geprint_posten';
    case 'gereed_voor_print':
      return 'printklaar';
    case 'concept_controleren':
    case 'brief_voorbereiden':
      return 'brief_opstellen';
    case 'onderzoek':
    case null:
      return 'eigenaar_achterhalen';
  }
}

export function meetProductiekernWorkflowPariteit(input: {
  selectieIds: readonly string[];
  productiekernDossiers: readonly AcquisitiedossierContract[];
  legacyContextPerSelectieId: ReadonlyMap<string, WerkbakContext>;
}): ProductiekernWorkflowPariteit {
  const productiekernPerSelectie = new Map(
    input.productiekernDossiers.map((dossier) => [dossier.selectieId, dossier] as const),
  );

  let vergelijkbaar = 0;
  let gelijk = 0;
  let afwijkend = 0;
  let legacyOntbreekt = 0;
  let productiekernOntbreekt = 0;

  for (const selectieId of input.selectieIds) {
    const legacy = input.legacyContextPerSelectieId.get(selectieId);
    const productiekern = productiekernPerSelectie.get(selectieId);

    if (!legacy) {
      legacyOntbreekt += 1;
      continue;
    }
    if (!productiekern) {
      productiekernOntbreekt += 1;
      continue;
    }

    vergelijkbaar += 1;
    if (mapLegacyWerkbakNaarOperationeleWerkbak(legacy) === productiekern.primaireWerkbak) {
      gelijk += 1;
    } else {
      afwijkend += 1;
    }
  }

  return {
    totaalSelecties: input.selectieIds.length,
    vergelijkbaar,
    gelijk,
    afwijkend,
    legacyOntbreekt,
    productiekernOntbreekt,
  };
}
