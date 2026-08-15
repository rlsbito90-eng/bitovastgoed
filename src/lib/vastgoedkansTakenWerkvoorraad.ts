import type { Vastgoedkans } from '@/lib/vastgoedkansen';
import {
  bepaalVastgoedkansActieContext,
  filterEnSorteerVastgoedkansen,
  type VastgoedkansActieContext,
  type VastgoedkansLijstWorkspaceState,
} from '@/lib/vastgoedkansWorkspace';
import type { VastgoedkansLijstTaak } from '@/hooks/useVastgoedkansLijstTaken';

export type VastgoedkansTaakActieContext = Omit<VastgoedkansActieContext, 'bron'> & {
  bron: VastgoedkansActieContext['bron'] | 'taak';
};

function projecteerTaakOpKans(kans: Vastgoedkans, taak: VastgoedkansLijstTaak | null | undefined): Vastgoedkans {
  if (!taak) return kans;
  return {
    ...kans,
    volgendeActieOmschrijving: taak.titel?.trim() || 'Taak uitvoeren',
    volgendeActieDatum: taak.deadline,
  };
}

export function bepaalVastgoedkansActieContextMetTaak(
  kans: Vastgoedkans,
  taak: VastgoedkansLijstTaak | null | undefined,
  vandaag?: string,
): VastgoedkansTaakActieContext {
  if (!taak) return bepaalVastgoedkansActieContext(kans, vandaag);

  // Een echte open centrale taak blijft een operationele actie, ook wanneer het
  // commerciële dossier inmiddels is afgesloten. Alleen voor deze read-projectie
  // omzeilen we daarom de gesloten-dossier guard; de Vastgoedkans zelf wordt niet
  // gemuteerd en krijgt geen andere commerciële status.
  const taakProjectie = projecteerTaakOpKans(kans, taak);
  const context = bepaalVastgoedkansActieContext(
    kans.status === 'afgevallen' || kans.status === 'gepromoveerd'
      ? { ...taakProjectie, status: 'opvolgen' }
      : taakProjectie,
    vandaag,
  );

  return { ...context, bron: 'taak' };
}

export function filterEnSorteerVastgoedkansenMetTaken(
  kansen: Vastgoedkans[],
  state: VastgoedkansLijstWorkspaceState,
  taakPerKansId: ReadonlyMap<string, VastgoedkansLijstTaak>,
): Vastgoedkans[] {
  if (taakPerKansId.size === 0) return filterEnSorteerVastgoedkansen(kansen, state);

  const origineelPerId = new Map(kansen.map((kans) => [kans.id, kans]));
  const geprojecteerd = kansen.map((kans) => projecteerTaakOpKans(kans, taakPerKansId.get(kans.id)));
  return filterEnSorteerVastgoedkansen(geprojecteerd, state)
    .map((kans) => origineelPerId.get(kans.id) ?? kans);
}
