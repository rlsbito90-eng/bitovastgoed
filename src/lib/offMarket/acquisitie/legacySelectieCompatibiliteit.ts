import type { AcquisitiedossierContract } from './productiekernContract';

/** Exacte, via productie-export bevestigde kolommen van
 * `off_market_acquisitie_selectie`.
 */
export interface LegacyAcquisitieSelectieRij {
  id: string;
  signaal_id: string;
  notitie: string | null;
  toegevoegd_door: string | null;
  toegevoegd_op: string | null;
  archived_at: string | null;
}

export interface LegacySelectieCompatibiliteitOpties {
  /**
   * Alleen een expliciet, reeds persistent bewezen tijdstip mag een dossier uit
   * `nieuwe_selectie` halen. `toegevoegd_op`, notities en brieven worden hier
   * bewust niet als heuristiek gebruikt.
   */
  verwerkingGestartOp?: string | null;
  verwerkingGestartDoor?: string | null;
  objectId?: string | null;
  volgendeActieOp?: string | null;
  volgendeActieOmschrijving?: string | null;
}

export interface LegacySelectieCompatibiliteitResultaat {
  dossier: AcquisitiedossierContract;
  legacy: {
    selectieId: string;
    notitie: string | null;
    toegevoegdDoor: string | null;
    toegevoegdOp: string | null;
    gearchiveerdOp: string | null;
  };
  waarschuwingen: string[];
}

/**
 * Read-only overgangsadapter voor bestaande selectierecords.
 *
 * De huidige tabel bevat nog geen expliciete processtart of primaire werkbak.
 * Daarom blijft een niet-gearchiveerd legacyrecord standaard in
 * `nieuwe_selectie`, totdat BUILD A een aparte persistente startmarkering heeft.
 */
export function legacySelectieNaarProductiekern(
  rij: LegacyAcquisitieSelectieRij,
  opties: LegacySelectieCompatibiliteitOpties = {},
): LegacySelectieCompatibiliteitResultaat {
  const verwerkingGestartOp = opties.verwerkingGestartOp ?? null;
  const waarschuwingen: string[] = [];

  if (rij.archived_at) {
    waarschuwingen.push(
      'Selectierecord is gearchiveerd; het mag niet als actief productiedossier worden aangeboden.',
    );
  }

  if (opties.verwerkingGestartDoor && !verwerkingGestartOp) {
    waarschuwingen.push(
      'Verwerker is opgegeven zonder expliciet verwerkingstijdstip; processtart blijft onbewezen.',
    );
  }

  return {
    dossier: {
      selectieId: rij.id,
      signaalId: rij.signaal_id,
      objectId: opties.objectId ?? null,
      verwerkingGestartOp,
      verwerkingGestartDoor: verwerkingGestartOp
        ? (opties.verwerkingGestartDoor ?? null)
        : null,
      primaireWerkbak: rij.archived_at ? 'afgehandeld' : 'nieuwe_selectie',
      volgendeActieOp: opties.volgendeActieOp ?? null,
      volgendeActieOmschrijving: opties.volgendeActieOmschrijving ?? null,
    },
    legacy: {
      selectieId: rij.id,
      notitie: rij.notitie,
      toegevoegdDoor: rij.toegevoegd_door,
      toegevoegdOp: rij.toegevoegd_op,
      gearchiveerdOp: rij.archived_at,
    },
    waarschuwingen,
  };
}
