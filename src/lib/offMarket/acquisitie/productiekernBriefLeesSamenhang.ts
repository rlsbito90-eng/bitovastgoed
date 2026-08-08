import type { BriefContract, BriefversieContract } from './productiekernContract';

export interface ProductiekernBriefLeesSamenhang {
  geldig: boolean;
  blokkades: string[];
  actieveVersie: BriefversieContract | null;
}

/**
 * Controleert de samenhang tussen de briefkern en de afzonderlijk gelezen
 * versielijst. De functie herstelt of kiest niets heuristisch; drift blokkeert.
 */
export function beoordeelProductiekernBriefLeesSamenhang(
  brief: BriefContract,
  versies: readonly BriefversieContract[],
): ProductiekernBriefLeesSamenhang {
  const blokkades: string[] = [];
  const verkeerdeBrief = versies.some((versie) => versie.briefId !== brief.id);
  if (verkeerdeBrief) blokkades.push('Briefversielijst bevat een versie van een andere brief.');

  const actieveStatussen = versies.filter((versie) => versie.status === 'actief');
  if (actieveStatussen.length > 1) blokkades.push('Meer dan één briefversie heeft status actief.');

  let actieveVersie: BriefversieContract | null = null;
  if (brief.actieveVersie === null) {
    if (actieveStatussen.length > 0) {
      blokkades.push('Briefkern mist actieve versie terwijl een versie actief is.');
    }
  } else {
    actieveVersie = versies.find(
      (versie) => versie.versienummer === brief.actieveVersie,
    ) ?? null;
    if (!actieveVersie) {
      blokkades.push('De actieve versie uit de briefkern ontbreekt in de versielijst.');
    } else if (actieveVersie.status !== 'actief') {
      blokkades.push('De actieve versie uit de briefkern heeft geen actieve status.');
    }
  }

  if (brief.status === 'definitief' && brief.briefnummer === null) {
    blokkades.push('Definitieve brief heeft geen briefnummer.');
  }
  if (brief.status === 'concept' && brief.definitiefOp !== null) {
    blokkades.push('Conceptbrief bevat een definitiefdatum.');
  }

  return {
    geldig: blokkades.length === 0,
    blokkades,
    actieveVersie: blokkades.length === 0 ? actieveVersie : null,
  };
}
