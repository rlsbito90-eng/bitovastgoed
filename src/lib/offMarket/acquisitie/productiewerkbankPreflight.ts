export type ProductiePreflightStatus = 'gereed' | 'aandacht' | 'verwerkt';

export type ProductiePreflightReden =
  | 'productiedossier_niet_gestart'
  | 'geen_actief_postconcept'
  | 'postadres_onvolledig'
  | 'geadresseerde_ontbreekt'
  | 'al_definitief';

export interface ProductiePreflightSelectie {
  selectieId: string;
  signaalId: string;
}

export interface ProductiePreflightBrief {
  id: string;
  signaalId: string;
  kanaal?: string | null;
  status?: string | null;
  archivedAt?: string | null;
  eigenaarNaam?: string | null;
  eigenaarBedrijfsnaam?: string | null;
  verzendadres?: string | null;
}

export interface ProductiePreflightInvoer {
  geselecteerdeSignaalIds: readonly string[];
  selecties: readonly ProductiePreflightSelectie[];
  formeleDossierSelectieIds: ReadonlySet<string>;
  brieven: readonly ProductiePreflightBrief[];
  isVolledigPostadres: (adres: string | null | undefined) => boolean;
}

export interface ProductiePreflightRegel {
  signaalId: string;
  selectieId: string | null;
  status: ProductiePreflightStatus;
  reden: ProductiePreflightReden | null;
  briefId: string | null;
}

export interface ProductiePreflightResultaat {
  regels: ProductiePreflightRegel[];
  telling: {
    totaal: number;
    gereed: number;
    aandacht: number;
    verwerkt: number;
  };
}

function isPost(brief: ProductiePreflightBrief): boolean {
  return (brief.kanaal ?? 'post') === 'post';
}

function isActief(brief: ProductiePreflightBrief): boolean {
  return !brief.archivedAt;
}

function heeftGeadresseerde(brief: ProductiePreflightBrief): boolean {
  return Boolean(brief.eigenaarBedrijfsnaam?.trim() || brief.eigenaarNaam?.trim());
}

/**
 * Read-only classificatie voor de formele productiewerkbank.
 *
 * Volgorde is bewust fail-closed:
 * 1. geen selectierecord / formeel dossier -> aandacht;
 * 2. reeds definitieve postbrief -> verwerkt;
 * 3. geen actief postconcept -> aandacht;
 * 4. adres/naam incompleet -> aandacht;
 * 5. anders gereed voor formele BR-finalisering.
 *
 * Deze functie voert geen mutaties uit en kent geen BR/BAT toe.
 */
export function bepaalProductiePreflight(
  invoer: ProductiePreflightInvoer,
): ProductiePreflightResultaat {
  const selectiePerSignaal = new Map(
    invoer.selecties.map((selectie) => [selectie.signaalId, selectie] as const),
  );

  const brievenPerSignaal = new Map<string, ProductiePreflightBrief[]>();
  for (const brief of invoer.brieven) {
    const lijst = brievenPerSignaal.get(brief.signaalId) ?? [];
    lijst.push(brief);
    brievenPerSignaal.set(brief.signaalId, lijst);
  }

  const regels: ProductiePreflightRegel[] = invoer.geselecteerdeSignaalIds.map((signaalId) => {
    const selectie = selectiePerSignaal.get(signaalId) ?? null;
    if (!selectie || !invoer.formeleDossierSelectieIds.has(selectie.selectieId)) {
      return {
        signaalId,
        selectieId: selectie?.selectieId ?? null,
        status: 'aandacht',
        reden: 'productiedossier_niet_gestart',
        briefId: null,
      };
    }

    const actievePostbrieven = (brievenPerSignaal.get(signaalId) ?? [])
      .filter((brief) => isPost(brief) && isActief(brief));

    const definitief = actievePostbrieven.find((brief) => brief.status === 'definitief');
    if (definitief) {
      return {
        signaalId,
        selectieId: selectie.selectieId,
        status: 'verwerkt',
        reden: 'al_definitief',
        briefId: definitief.id,
      };
    }

    const concept = actievePostbrieven.find((brief) => brief.status === 'concept');
    if (!concept) {
      return {
        signaalId,
        selectieId: selectie.selectieId,
        status: 'aandacht',
        reden: 'geen_actief_postconcept',
        briefId: null,
      };
    }

    if (!heeftGeadresseerde(concept)) {
      return {
        signaalId,
        selectieId: selectie.selectieId,
        status: 'aandacht',
        reden: 'geadresseerde_ontbreekt',
        briefId: concept.id,
      };
    }

    if (!invoer.isVolledigPostadres(concept.verzendadres)) {
      return {
        signaalId,
        selectieId: selectie.selectieId,
        status: 'aandacht',
        reden: 'postadres_onvolledig',
        briefId: concept.id,
      };
    }

    return {
      signaalId,
      selectieId: selectie.selectieId,
      status: 'gereed',
      reden: null,
      briefId: concept.id,
    };
  });

  return {
    regels,
    telling: {
      totaal: regels.length,
      gereed: regels.filter((regel) => regel.status === 'gereed').length,
      aandacht: regels.filter((regel) => regel.status === 'aandacht').length,
      verwerkt: regels.filter((regel) => regel.status === 'verwerkt').length,
    },
  };
}

export function productiePreflightRedenLabel(reden: ProductiePreflightReden | null): string | null {
  switch (reden) {
    case 'productiedossier_niet_gestart': return 'Productiedossier nog niet gestart';
    case 'geen_actief_postconcept': return 'Geen actief postconcept';
    case 'postadres_onvolledig': return 'Postadres ontbreekt of is onvolledig';
    case 'geadresseerde_ontbreekt': return 'Geadresseerde ontbreekt';
    case 'al_definitief': return 'Brief is al definitief';
    default: return null;
  }
}
