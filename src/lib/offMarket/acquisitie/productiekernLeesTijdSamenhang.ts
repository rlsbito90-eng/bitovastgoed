import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import {
  ProductiekernLeesTijdError,
  valideerProductiekernTijdstip,
} from './productiekernLeesTijd';

function parseCanoniekTijdstip(veld: string, waarde: string | null): number | null {
  if (waarde === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(waarde)) {
    throw new ProductiekernLeesTijdError(veld, 'geen canoniek UTC-tijdstip');
  }
  const tijdMs = Date.parse(waarde);
  if (!Number.isFinite(tijdMs)) {
    throw new ProductiekernLeesTijdError(veld, 'niet parseerbaar');
  }
  return tijdMs;
}

function nietNa(
  eerderVeld: string,
  eerder: string | null,
  laterVeld: string,
  later: string | null,
): void {
  const eerderMs = parseCanoniekTijdstip(eerderVeld, eerder);
  const laterMs = parseCanoniekTijdstip(laterVeld, later);
  if (eerderMs !== null && laterMs !== null && eerderMs > laterMs) {
    throw new ProductiekernLeesTijdError(
      laterVeld,
      `ligt vóór ${eerderVeld}`,
    );
  }
}

export function bewaakDossierLeesTijd(
  dossier: AcquisitiedossierContract,
  nuMs = Date.now(),
): AcquisitiedossierContract {
  valideerProductiekernTijdstip(
    'verwerkingGestartOp',
    dossier.verwerkingGestartOp,
    nuMs,
  );
  // Een volgende actie mag bewust in de toekomst liggen, maar moet canoniek zijn.
  parseCanoniekTijdstip('volgendeActieOp', dossier.volgendeActieOp);
  return dossier;
}

export function bewaakBriefLeesTijd(
  brief: BriefContract,
  nuMs = Date.now(),
): BriefContract {
  valideerProductiekernTijdstip('definitiefOp', brief.definitiefOp, nuMs);
  valideerProductiekernTijdstip('vergrendeldOp', brief.vergrendeldOp, nuMs);
  nietNa('definitiefOp', brief.definitiefOp, 'vergrendeldOp', brief.vergrendeldOp);
  return brief;
}

export function bewaakBriefversieLeesTijd(
  versie: BriefversieContract,
  nuMs = Date.now(),
): BriefversieContract {
  valideerProductiekernTijdstip('createdAt', versie.createdAt, nuMs);
  valideerProductiekernTijdstip('vervallenOp', versie.vervallenOp, nuMs);
  valideerProductiekernTijdstip('verzondenOp', versie.verzondenOp, nuMs);
  nietNa('createdAt', versie.createdAt, 'vervallenOp', versie.vervallenOp);
  nietNa('createdAt', versie.createdAt, 'verzondenOp', versie.verzondenOp);
  return versie;
}

export function bewaakPrintbatchLeesTijd(
  batch: PrintbatchContract,
  nuMs = Date.now(),
): PrintbatchContract {
  valideerProductiekernTijdstip('printdatum', batch.printdatum, nuMs);
  valideerProductiekernTijdstip('verzenddatum', batch.verzenddatum, nuMs);
  valideerProductiekernTijdstip('geannuleerdOp', batch.geannuleerdOp, nuMs);
  nietNa('printdatum', batch.printdatum, 'verzenddatum', batch.verzenddatum);
  return batch;
}
