import type { LegacyOffMarketBriefRij } from './legacyBriefCompatibiliteit';

export type LegacyProductiestatus =
  | 'concept'
  | 'printklaar'
  | 'geprint'
  | 'gepost'
  | 'verzonden_onzeker'
  | 'gearchiveerd';

export interface LegacyProductiestatusResultaat {
  status: LegacyProductiestatus;
  printBevestigd: boolean;
  postBevestigd: boolean;
  verzendbewijsOp: string | null;
  waarschuwingen: string[];
}

/**
 * Centrale read-only pariteitsregel voor bestaande briefvelden.
 * Printen wordt nooit gelijkgesteld aan posten; `verstuurd` zonder postdatum
 * blijft expliciet onzeker in plaats van als bewezen posthandeling te gelden.
 */
export function bepaalLegacyProductiestatus(
  rij: LegacyOffMarketBriefRij,
): LegacyProductiestatusResultaat {
  const waarschuwingen: string[] = [];

  if (rij.archived_at) {
    return {
      status: 'gearchiveerd',
      printBevestigd: Boolean(rij.printdatum),
      postBevestigd: Boolean(rij.postdatum),
      verzendbewijsOp: rij.postdatum ?? rij.verzonden_op,
      waarschuwingen,
    };
  }

  if (rij.postdatum) {
    return {
      status: 'gepost',
      printBevestigd: Boolean(rij.printdatum),
      postBevestigd: true,
      verzendbewijsOp: rij.postdatum,
      waarschuwingen,
    };
  }

  if (rij.status === 'verstuurd' || rij.verzonden_op || rij.verzendstatus === 'verstuurd') {
    waarschuwingen.push(
      'Legacy record meldt verzending zonder afzonderlijke postdatum; posthandeling is niet hard bewezen.',
    );
    return {
      status: 'verzonden_onzeker',
      printBevestigd: Boolean(rij.printdatum),
      postBevestigd: false,
      verzendbewijsOp: rij.verzonden_op,
      waarschuwingen,
    };
  }

  if (rij.printdatum) {
    return {
      status: 'geprint',
      printBevestigd: true,
      postBevestigd: false,
      verzendbewijsOp: null,
      waarschuwingen,
    };
  }

  if (rij.brieftekst?.trim()) {
    return {
      status: 'printklaar',
      printBevestigd: false,
      postBevestigd: false,
      verzendbewijsOp: null,
      waarschuwingen,
    };
  }

  return {
    status: 'concept',
    printBevestigd: false,
    postBevestigd: false,
    verzendbewijsOp: null,
    waarschuwingen,
  };
}
