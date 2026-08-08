import type { OffMarketSignaal } from '@/lib/offMarket/types';
import {
  viewModelVoorPlanItem,
  type PlanItem,
} from './bulkBrief';

export type ProductiekernBriefVoorbereidingActie =
  | 'productiekern_aanmaken'
  | 'bestaand_concept_koppelen'
  | 'overslaan';

export interface ProductiekernBriefVoorbereiding {
  actie: ProductiekernBriefVoorbereidingActie;
  signaalId: string;
  geadresseerdeKey: string;
  bestaandeBriefId: string | null;
  reden: string | null;
  inhoudSnapshot: Record<string, unknown> | null;
  geadresseerdeSnapshot: Record<string, unknown> | null;
}

/**
 * Vertaalt de bestaande bewezen briefplanner naar expliciete Productiekern-
 * intenties zonder zelf te schrijven.
 *
 * Cruciaal: een bestaand legacyconcept wordt NOOIT als nieuwe Productiekernbrief
 * aangemaakt. Dat vereist een aparte transactionele bridge die het bestaande
 * briefrecord aan het formele dossier koppelt. Tot die bridge bestaat, blijft
 * deze toestand expliciet herkenbaar en kan de UI dubbelingen voorkomen.
 */
export function bepaalProductiekernBriefVoorbereiding(args: {
  signaal: OffMarketSignaal;
  plan: PlanItem;
}): ProductiekernBriefVoorbereiding {
  const { signaal, plan } = args;

  if (plan.actie === 'overslaan') {
    return {
      actie: 'overslaan',
      signaalId: plan.signaalId,
      geadresseerdeKey: plan.geadresseerdeKey,
      bestaandeBriefId: plan.bestaandeBrief?.id ?? null,
      reden: plan.reden ?? 'Brief wordt volgens het bestaande briefplan overgeslagen.',
      inhoudSnapshot: null,
      geadresseerdeSnapshot: null,
    };
  }

  if (plan.actie === 'hergebruiken') {
    return {
      actie: 'bestaand_concept_koppelen',
      signaalId: plan.signaalId,
      geadresseerdeKey: plan.geadresseerdeKey,
      bestaandeBriefId: plan.bestaandeBrief?.id ?? null,
      reden: 'Bestaand concept moet transactioneel aan het Productiekern-dossier worden gekoppeld; geen duplicaat aanmaken.',
      inhoudSnapshot: null,
      geadresseerdeSnapshot: null,
    };
  }

  const vm = viewModelVoorPlanItem({ signaal, plan });
  const a = signaal as Record<string, unknown>;
  const objectadres = typeof a.adres === 'string' ? a.adres : null;

  return {
    actie: 'productiekern_aanmaken',
    signaalId: plan.signaalId,
    geadresseerdeKey: plan.geadresseerdeKey,
    bestaandeBriefId: null,
    reden: null,
    inhoudSnapshot: {
      onderwerp: vm.onderwerp,
      brieftekst: vm.brieftekst,
      objectadres,
      objectomschrijving: vm.objectomschrijving,
      kanaal: 'post',
      campagne_stap: plan.campagneStap,
    },
    geadresseerdeSnapshot: {
      geadresseerde_key: plan.geadresseerdeKey,
      naam: plan.kandidaat.naam,
      bedrijfsnaam: plan.kandidaat.bedrijfsnaam,
      verzendadres: plan.kandidaat.verzendadres,
    },
  };
}
