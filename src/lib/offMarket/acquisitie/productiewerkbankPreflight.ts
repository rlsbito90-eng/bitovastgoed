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

function maakRegelVoorBrief(
  signaalId: string,
  selectieId: string,
  brief: ProductiePreflightBrief,
  invoer: ProductiePreflightInvoer,
): ProductiePreflightRegel {
  if (brief.status === 'definitief') {
    return {
      signaalId,
      selectieId,
      status: 'verwerkt',
      reden: 'al_definitief',
      briefId: brief.id,
    };
  }

  if (!heeftGeadresseerde(brief)) {
    return {
      signaalId,
      selectieId,
      status: 'aandacht',
      reden: 'geadresseerde_ontbreekt',
      briefId: brief.id,
    };
  }

  if (!invoer.isVolledigPostadres(brief.verzendadres)) {
    return {
      signaalId,
      selectieId,
      status: 'aandacht',
      reden: 'postadres_onvolledig',
      briefId: brief.id,
    };
  }

  return {
    signaalId,
    selectieId,
    status: 'gereed',
    reden: null,
    briefId: brief.id,
  };
}

/**
 * Read-only classificatie voor de formele productiewerkbank.
 *
 * De classificatie is bewust per actieve postbrief, niet alleen per signaal.
 * Eén object kan immers meerdere eigenaren/geadresseerden en dus meerdere
 * afzonderlijke brieven hebben. Een reeds definitieve brief mag daardoor nooit
 * een tweede conceptbrief van hetzelfde signaal als "verwerkt" verbergen.
 *
 * Fail-closed volgorde per geselecteerd signaal:
 * 1. geen selectierecord / formeel dossier -> alle actieve postbrieven aandacht;
 * 2. actieve definitieve postbrief -> verwerkt;
 * 3. actief postconcept -> individueel naam/adres controleren;
 * 4. geen actieve postbrief -> één signaalregel aandacht.
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

  const regels: ProductiePreflightRegel[] = [];

  for (const signaalId of invoer.geselecteerdeSignaalIds) {
    const selectie = selectiePerSignaal.get(signaalId) ?? null;
    const actievePostbrieven = (brievenPerSignaal.get(signaalId) ?? [])
      .filter((brief) => isPost(brief) && isActief(brief))
      .filter((brief) => brief.status === 'concept' || brief.status === 'definitief');

    if (!selectie || !invoer.formeleDossierSelectieIds.has(selectie.selectieId)) {
      if (actievePostbrieven.length === 0) {
        regels.push({
          signaalId,
          selectieId: selectie?.selectieId ?? null,
          status: 'aandacht',
          reden: 'productiedossier_niet_gestart',
          briefId: null,
        });
      } else {
        for (const brief of actievePostbrieven) {
          regels.push({
            signaalId,
            selectieId: selectie?.selectieId ?? null,
            status: 'aandacht',
            reden: 'productiedossier_niet_gestart',
            briefId: brief.id,
          });
        }
      }
      continue;
    }

    if (actievePostbrieven.length === 0) {
      regels.push({
        signaalId,
        selectieId: selectie.selectieId,
        status: 'aandacht',
        reden: 'geen_actief_postconcept',
        briefId: null,
      });
      continue;
    }

    for (const brief of actievePostbrieven) {
      regels.push(maakRegelVoorBrief(signaalId, selectie.selectieId, brief, invoer));
    }
  }

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
