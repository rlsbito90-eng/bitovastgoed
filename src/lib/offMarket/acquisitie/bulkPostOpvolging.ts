// Canonieke planning voor bestaande Radar-postopvolging.
//
// Anders dan de koude acquisitieroute begint deze flow bij de daadwerkelijk
// verzonden brief per geadresseerde. Een expliciete selectie wordt daarom
// nooit opnieuw gegroepeerd of verkleind op partij/campagne.

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';
import {
  responsVervangtStandaardOpvolging,
  type Responsstatus,
} from '@/lib/offMarket/brieven/respons';
import {
  bouwBriefPlan,
  bouwKandidatenVoorSignaal,
  type BulkKandidaat,
  type PlanItem,
} from './bulkBrief';
import { volgendePostCampagneStap } from './postCampagneVoortgang';

const STAPPEN: CampagneStap[] = ['brief_1', 'brief_2', 'brief_3'];

export type PostOpvolgUitzondering =
  | 'geen_verzonden_brief'
  | 'respons_geregistreerd'
  | 'reeks_compleet'
  | 'geadresseerde_onvolledig';

export interface PostOpvolgRij {
  kandidaat: BulkKandidaat;
  volgendeStap: CampagneStap | null;
  productieToegestaan: boolean;
  uitzondering: PostOpvolgUitzondering | null;
  reden: string;
}

export interface BulkPostOpvolgPlan {
  rijen: PostOpvolgRij[];
  plan: PlanItem[];
  telling: {
    signalen: number;
    geadresseerden: number;
    brieven: number;
    uitzonderingen: number;
  };
}

function sleutelVoorBrief(brief: OffMarketBrief): string {
  return brief.geadresseerde_key ?? geadresseerdeKey(brief);
}

function relevantePostbrieven(
  brieven: readonly OffMarketBrief[],
  kandidaat: BulkKandidaat,
): OffMarketBrief[] {
  return brieven.filter((brief) =>
    brief.signaal_id === kandidaat.signaalId
      && !brief.archived_at
      && (brief.kanaal ?? 'post') === 'post'
      && sleutelVoorBrief(brief) === kandidaat.geadresseerdeKey,
  );
}

function bouwRij(kandidaat: BulkKandidaat, brieven: readonly OffMarketBrief[]): PostOpvolgRij {
  const relevant = relevantePostbrieven(brieven, kandidaat);
  const respons = relevant.find((brief) =>
    responsVervangtStandaardOpvolging(brief.responsstatus as Responsstatus | null),
  );
  if (respons) {
    return {
      kandidaat, volgendeStap: null, productieToegestaan: false,
      uitzondering: 'respons_geregistreerd',
      reden: 'Er is al een reactie geregistreerd; vervolg deze persoonlijk in plaats van met een standaardbrief.',
    };
  }
  if (!kandidaat.geschikt) {
    return {
      kandidaat, volgendeStap: null, productieToegestaan: false,
      uitzondering: 'geadresseerde_onvolledig',
      reden: kandidaat.blokkade ?? 'Naam of postadres is onvolledig.',
    };
  }
  const verstuurd = relevant.some((brief) => brief.status === 'verstuurd');
  if (!verstuurd) {
    return {
      kandidaat, volgendeStap: null, productieToegestaan: false,
      uitzondering: 'geen_verzonden_brief',
      reden: 'Voor deze geadresseerde is nog geen postbrief als verzonden geregistreerd.',
    };
  }
  const stap = volgendePostCampagneStap(relevant);
  if (!stap) {
    return {
      kandidaat, volgendeStap: null, productieToegestaan: false,
      uitzondering: 'reeks_compleet',
      reden: 'Brief 1, 2 en 3 zijn al verzonden; de standaardreeks is afgerond.',
    };
  }
  return {
    kandidaat, volgendeStap: stap, productieToegestaan: true,
    uitzondering: null,
    reden: `${stap === 'brief_2' ? 'Brief 1' : 'Brief 2'} is verzonden; ${stap === 'brief_2' ? 'Brief 2' : 'Brief 3'} is de volgende stap.`,
  };
}

export function bouwBulkPostOpvolgPlan(args: {
  signalen: readonly OffMarketSignaal[];
  brieven: readonly OffMarketBrief[];
  uitgeslotenKeys?: ReadonlySet<string>;
}): BulkPostOpvolgPlan {
  const geselecteerd = new Set(args.signalen.map((signaal) => signaal.id));
  const brieven = args.brieven.filter((brief) => geselecteerd.has(brief.signaal_id));
  const perSignaal = new Map<string, OffMarketBrief[]>();
  for (const brief of brieven) {
    const lijst = perSignaal.get(brief.signaal_id) ?? [];
    lijst.push(brief);
    perSignaal.set(brief.signaal_id, lijst);
  }

  const rijen = args.signalen.flatMap((signaal) =>
    bouwKandidatenVoorSignaal(signaal, perSignaal.get(signaal.id) ?? [])
      .map((kandidaat) => bouwRij(kandidaat, brieven)),
  );
  const productieRijen = rijen.filter((rij) =>
    rij.productieToegestaan
      && rij.volgendeStap
      && !args.uitgeslotenKeys?.has(`${rij.kandidaat.signaalId}|${rij.kandidaat.geadresseerdeKey}`),
  );

  const plan = STAPPEN.flatMap((campagneStap) => {
    const kandidaten = productieRijen
      .filter((rij) => rij.volgendeStap === campagneStap)
      .map((rij) => rij.kandidaat);
    return kandidaten.length > 0
      ? bouwBriefPlan({ kandidaten, brieven, campagneStap })
      : [];
  });

  return {
    rijen,
    plan,
    telling: {
      signalen: new Set(args.signalen.map((signaal) => signaal.id)).size,
      geadresseerden: rijen.length,
      brieven: plan.filter((item) => item.actie !== 'overslaan').length,
      uitzonderingen: rijen.filter((rij) => !rij.productieToegestaan).length,
    },
  };
}
