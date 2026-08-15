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

export interface VastgoedkansTaakConsistentieWaarschuwing {
  code: 'open_taak_op_afgesloten_dossier';
  label: string;
}

export const VASTGOEDKANS_TAAK_PRIORITEIT_LABEL: Record<VastgoedkansLijstTaak['prioriteit'], string> = {
  urgent: 'Urgent',
  hoog: 'Hoog',
  normaal: 'Normaal',
  laag: 'Laag',
};

function projecteerTaakOpKans(kans: Vastgoedkans, taak: VastgoedkansLijstTaak | null | undefined): Vastgoedkans {
  if (!taak) return kans;
  return {
    ...kans,
    volgendeActieOmschrijving: taak.titel?.trim() || 'Taak uitvoeren',
    volgendeActieDatum: taak.deadline,
  };
}

const millis = (waarde: string | null | undefined): number | null => {
  if (!waarde) return null;
  const n = Date.parse(waarde);
  return Number.isNaN(n) ? null : n;
};

const vergelijkNullableDatum = (a: string | null, b: string | null): number => {
  const aa = millis(a);
  const bb = millis(b);
  if (aa == null && bb == null) return 0;
  if (aa == null) return 1;
  if (bb == null) return -1;
  return aa - bb;
};

export function bepaalVastgoedkansTaakConsistentie(
  kans: Vastgoedkans,
  taak: VastgoedkansLijstTaak | null | undefined,
): VastgoedkansTaakConsistentieWaarschuwing | null {
  if (!taak) return null;
  if (kans.status !== 'afgevallen' && kans.status !== 'gepromoveerd') return null;
  return {
    code: 'open_taak_op_afgesloten_dossier',
    label: 'Open taak op afgesloten dossier',
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
  const gefilterd = filterEnSorteerVastgoedkansen(geprojecteerd, state);

  // Filteren blijft bewust op de echte commerciële dossierstatus gebeuren. Voor
  // operationele sorteringen moet daarna echter exact dezelfde taakbewuste context
  // gelden als in de rijweergave. Zo blijft een ongedateerde open taak op een
  // afgesloten dossier rang 'zonder datum' houden in plaats van 'geen actie'.
  if (state.sortering === 'werkvolgorde' || state.sortering === 'opvolgdatum') {
    gefilterd.sort((a, b) => {
      const origineelA = origineelPerId.get(a.id) ?? a;
      const origineelB = origineelPerId.get(b.id) ?? b;
      const aa = bepaalVastgoedkansActieContextMetTaak(origineelA, taakPerKansId.get(a.id));
      const bb = bepaalVastgoedkansActieContextMetTaak(origineelB, taakPerKansId.get(b.id));

      if (state.sortering === 'werkvolgorde') {
        return aa.rang - bb.rang
          || vergelijkNullableDatum(aa.datum, bb.datum)
          || (origineelB.prioriteit ?? 0) - (origineelA.prioriteit ?? 0)
          || (millis(origineelB.updatedAt) ?? 0) - (millis(origineelA.updatedAt) ?? 0);
      }

      return vergelijkNullableDatum(aa.datum, bb.datum)
        || (millis(origineelB.updatedAt) ?? 0) - (millis(origineelA.updatedAt) ?? 0);
    });
  }

  return gefilterd.map((kans) => origineelPerId.get(kans.id) ?? kans);
}
