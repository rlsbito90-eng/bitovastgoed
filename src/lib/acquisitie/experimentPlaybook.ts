import type { ConversieRij } from '@/lib/acquisitie/conversieDashboard';

export const ACQUISITIE_EXPERIMENT_PLAYBOOK = {
  minimumLooptijdDagen: 28,
  minimumPerVariant: 30,
  streefPerVariant: 75,
  minimumRelatieveUplift: 0.25,
  minimumAbsoluteUpliftPunt: 2,
} as const;

export type ExperimentStatus =
  | 'wacht_op_challenger'
  | 'opstart'
  | 'dataverzameling'
  | 'beslismoment'
  | 'kandidaat_winnaar';

export interface ExperimentVariantRij extends ConversieRij {
  variantCode: string;
  isControl: boolean;
}

export interface ExperimentPlaybookModel {
  sleutel: string;
  label: string;
  profiel: string;
  kanaal: string;
  campagneStap: string;
  eersteVerzending: string | null;
  looptijdDagen: number;
  varianten: ExperimentVariantRij[];
  status: ExperimentStatus;
  statusLabel: string;
  advies: string;
  kandidaatVariantCode: string | null;
  checks: {
    meerdereVarianten: boolean;
    minimumLooptijd: boolean;
    minimumVolume: boolean;
    streefvolume: boolean;
  };
}

const statusLabel: Record<ExperimentStatus, string> = {
  wacht_op_challenger: 'Wacht op challenger',
  opstart: 'Opstart',
  dataverzameling: 'Data verzamelen',
  beslismoment: 'Beslismoment',
  kandidaat_winnaar: 'Kandidaat-winnaar',
};

const dagenTussen = (vanaf: string | null, nu: Date) => {
  if (!vanaf) return 0;
  return Math.max(0, Math.floor((nu.getTime() - new Date(vanaf).getTime()) / 86_400_000));
};

export function beoordeelExperiment(args: {
  sleutel: string;
  label: string;
  profiel: string;
  kanaal: string;
  campagneStap: string;
  eersteVerzending: string | null;
  varianten: ExperimentVariantRij[];
  nu?: Date;
}): ExperimentPlaybookModel {
  const regels = ACQUISITIE_EXPERIMENT_PLAYBOOK;
  const nu = args.nu ?? new Date();
  const looptijdDagen = dagenTussen(args.eersteVerzending, nu);
  const actieveVarianten = args.varianten.filter(v => v.verzonden > 0);
  const meerdereVarianten = actieveVarianten.length >= 2;
  const minimumLooptijd = looptijdDagen >= regels.minimumLooptijdDagen;
  const minimumVolume = meerdereVarianten && actieveVarianten.every(v => v.verzonden >= regels.minimumPerVariant);
  const streefvolume = meerdereVarianten && actieveVarianten.every(v => v.verzonden >= regels.streefPerVariant);

  if (!meerdereVarianten) {
    return {
      ...args,
      looptijdDagen,
      status: 'wacht_op_challenger',
      statusLabel: statusLabel.wacht_op_challenger,
      advies: 'Alleen de controlevariant heeft verkeer. Voeg pas een challenger toe met één duidelijke hypothese.',
      kandidaatVariantCode: null,
      checks: { meerdereVarianten, minimumLooptijd, minimumVolume, streefvolume },
    };
  }

  if (!minimumLooptijd) {
    return {
      ...args,
      looptijdDagen,
      status: 'opstart',
      statusLabel: statusLabel.opstart,
      advies: `Laat de verdeling ongewijzigd doorlopen tot minimaal ${regels.minimumLooptijdDagen} dagen.`,
      kandidaatVariantCode: null,
      checks: { meerdereVarianten, minimumLooptijd, minimumVolume, streefvolume },
    };
  }

  if (!minimumVolume) {
    return {
      ...args,
      looptijdDagen,
      status: 'dataverzameling',
      statusLabel: statusLabel.dataverzameling,
      advies: `Nog geen conclusie. Verzamel minimaal ${regels.minimumPerVariant} verzendingen per actieve variant.`,
      kandidaatVariantCode: null,
      checks: { meerdereVarianten, minimumLooptijd, minimumVolume, streefvolume },
    };
  }

  const control = actieveVarianten.find(v => v.isControl) ?? actieveVarianten.find(v => v.variantCode === 'A') ?? null;
  const challengers = actieveVarianten.filter(v => v !== control);
  const beste = [...challengers].sort((a, b) => b.positieveResponspercentage - a.positieveResponspercentage)[0] ?? null;
  const absoluteUplift = control && beste ? beste.positieveResponspercentage - control.positieveResponspercentage : 0;
  const relatieveUplift = control && beste && control.positieveResponspercentage > 0
    ? (beste.positieveResponspercentage - control.positieveResponspercentage) / control.positieveResponspercentage
    : (beste?.positieveResponspercentage ?? 0) > 0 ? 1 : 0;
  const kandidaat = !!beste && !!control
    && absoluteUplift >= regels.minimumAbsoluteUpliftPunt
    && relatieveUplift >= regels.minimumRelatieveUplift;

  if (kandidaat && streefvolume) {
    return {
      ...args,
      looptijdDagen,
      status: 'kandidaat_winnaar',
      statusLabel: statusLabel.kandidaat_winnaar,
      advies: `Variant ${beste!.variantCode} presteert richtinggevend beter op positieve respons. Beoordeel inhoud en leadkwaliteit vóór promotie.`,
      kandidaatVariantCode: beste!.variantCode,
      checks: { meerdereVarianten, minimumLooptijd, minimumVolume, streefvolume },
    };
  }

  return {
    ...args,
    looptijdDagen,
    status: 'beslismoment',
    statusLabel: statusLabel.beslismoment,
    advies: streefvolume
      ? 'Er is voldoende volume voor een inhoudelijke beoordeling, maar nog geen duidelijke kandidaat-winnaar volgens het playbook.'
      : `Minimumvolume is bereikt. Laat bij voorkeur doorlopen richting ${regels.streefPerVariant} verzendingen per variant voordat je promoveert.`,
    kandidaatVariantCode: kandidaat ? beste?.variantCode ?? null : null,
    checks: { meerdereVarianten, minimumLooptijd, minimumVolume, streefvolume },
  };
}
