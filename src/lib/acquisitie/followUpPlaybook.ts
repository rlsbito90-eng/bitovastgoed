import type { Responsstatus } from '@/lib/offMarket/brieven/respons';
import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';

export const ACQUISITIE_FOLLOW_UP_PLAYBOOK = {
  brief2NaDagen: 21,
  brief3NaDagen: 28,
  nurtureNaBrief3Dagen: 270,
} as const;

export type FollowUpActie =
  | 'brief_1_nodig'
  | 'wachten'
  | 'brief_2_voorbereiden'
  | 'brief_3_voorbereiden'
  | 'nurture_herbenaderen'
  | 'handmatige_opvolging'
  | 'sequence_stop';

export interface FollowUpBesluit {
  actie: FollowUpActie;
  label: string;
  reden: string;
  vanafDatum: string | null;
}

const datumPlusDagen = (iso: string, dagen: number): string => {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
};

const datumBereikt = (datum: string, nu: Date): boolean =>
  new Date(`${datum}T00:00:00Z`).getTime() <= nu.getTime();

/**
 * Bepaalt alleen de aanbevolen volgende sequence-actie. Deze helper verstuurt
 * niets automatisch en maakt ook geen taken aan.
 */
export function bepaalFollowUpActie(args: {
  laatsteStap: CampagneStap | null;
  laatsteVerzondenOp: string | null;
  responsstatus?: Responsstatus | null;
  nu?: Date;
}): FollowUpBesluit {
  const nu = args.nu ?? new Date();
  const respons = args.responsstatus ?? 'geen_reactie';

  if (respons === 'later_opnieuw_benaderen') {
    return {
      actie: 'handmatige_opvolging',
      label: 'Later opnieuw benaderen',
      reden: 'Er is inhoudelijke respons. De standaardsequence pauzeert; volg de afgesproken timing met de relatie.',
      vanafDatum: null,
    };
  }

  if (respons !== 'geen_reactie') {
    return {
      actie: 'sequence_stop',
      label: 'Standaardsequence gestopt',
      reden: 'Er is inhoudelijke respons geregistreerd. Verdere opvolging hoort bij het gesprek of de uitkomst, niet bij de no-response sequence.',
      vanafDatum: null,
    };
  }

  if (!args.laatsteStap || !args.laatsteVerzondenOp) {
    return {
      actie: 'brief_1_nodig',
      label: 'Brief 1 voorbereiden',
      reden: 'Er is nog geen verzonden eerste touchpoint voor deze geadresseerde.',
      vanafDatum: null,
    };
  }

  if (args.laatsteStap === 'brief_1') {
    const vanaf = datumPlusDagen(args.laatsteVerzondenOp, ACQUISITIE_FOLLOW_UP_PLAYBOOK.brief2NaDagen);
    return datumBereikt(vanaf, nu)
      ? {
        actie: 'brief_2_voorbereiden',
        label: 'Brief 2 voorbereiden',
        reden: 'Geen reactie op Brief 1 en de minimale wachttijd is verstreken.',
        vanafDatum: vanaf,
      }
      : {
        actie: 'wachten',
        label: 'Wachten op reactie',
        reden: `Brief 2 wordt vanaf ${vanaf} geadviseerd wanneer er geen reactie komt.`,
        vanafDatum: vanaf,
      };
  }

  if (args.laatsteStap === 'brief_2') {
    const vanaf = datumPlusDagen(args.laatsteVerzondenOp, ACQUISITIE_FOLLOW_UP_PLAYBOOK.brief3NaDagen);
    return datumBereikt(vanaf, nu)
      ? {
        actie: 'brief_3_voorbereiden',
        label: 'Brief 3 voorbereiden',
        reden: 'Geen reactie op Brief 2 en de tweede wachttijd is verstreken.',
        vanafDatum: vanaf,
      }
      : {
        actie: 'wachten',
        label: 'Wachten op reactie',
        reden: `Brief 3 wordt vanaf ${vanaf} geadviseerd wanneer er geen reactie komt.`,
        vanafDatum: vanaf,
      };
  }

  const vanaf = datumPlusDagen(args.laatsteVerzondenOp, ACQUISITIE_FOLLOW_UP_PLAYBOOK.nurtureNaBrief3Dagen);
  return datumBereikt(vanaf, nu)
    ? {
      actie: 'nurture_herbenaderen',
      label: 'Nurture: opnieuw benaderen',
      reden: 'De primaire 3-touch sequence is afgerond zonder reactie; een rustige herbenadering is nu weer mogelijk.',
      vanafDatum: vanaf,
    }
    : {
      actie: 'wachten',
      label: 'Sequence afgerond',
      reden: `Na Brief 3 geen extra primaire brief. Herbenaderen wordt vanaf ${vanaf} geadviseerd.`,
      vanafDatum: vanaf,
    };
}
