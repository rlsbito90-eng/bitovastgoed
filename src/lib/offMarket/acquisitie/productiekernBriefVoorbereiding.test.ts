import { describe, expect, it } from 'vitest';

import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { PlanItem } from './bulkBrief';
import { bepaalProductiekernBriefVoorbereiding } from './productiekernBriefVoorbereiding';

const signaal = {
  id: 'signaal-1',
  adres: 'Teststraat 1, Amsterdam',
} as unknown as OffMarketSignaal;

function basisPlan(): PlanItem {
  return {
    signaalId: 'signaal-1',
    geadresseerdeKey: 'bedrijf|teststraat-2-amsterdam',
    campagneStap: 'brief_1',
    kanaal: 'post',
    actie: 'aanmaken',
    bestaandeBrief: null,
    reden: null,
    kandidaat: {
      signaalId: 'signaal-1',
      geadresseerdeKey: 'bedrijf|teststraat-2-amsterdam',
      naam: null,
      bedrijfsnaam: 'Voorbeeld B.V.',
      verzendadres: 'Teststraat 2\n1234 AB Amsterdam\nNederland',
      geschikt: true,
      blokkade: null,
      hints: [],
    },
  };
}

describe('productiekernBriefVoorbereiding', () => {
  it('maakt voor een nieuw planitem formele inhoud- en geadresseerdesnapshots', () => {
    const uit = bepaalProductiekernBriefVoorbereiding({ signaal, plan: basisPlan() });

    expect(uit.actie).toBe('productiekern_aanmaken');
    expect(uit.bestaandeBriefId).toBeNull();
    expect(uit.inhoudSnapshot).toEqual(expect.objectContaining({
      kanaal: 'post',
      campagne_stap: 'brief_1',
    }));
    expect(uit.geadresseerdeSnapshot).toEqual(expect.objectContaining({
      geadresseerde_key: 'bedrijf|teststraat-2-amsterdam',
      bedrijfsnaam: 'Voorbeeld B.V.',
    }));
  });

  it('weigert een bestaand legacyconcept stil als nieuwe Productiekernbrief te dupliceren', () => {
    const plan = basisPlan();
    plan.actie = 'hergebruiken';
    plan.bestaandeBrief = { id: 'legacy-brief-1' } as PlanItem['bestaandeBrief'];

    const uit = bepaalProductiekernBriefVoorbereiding({ signaal, plan });

    expect(uit.actie).toBe('bestaand_concept_koppelen');
    expect(uit.bestaandeBriefId).toBe('legacy-brief-1');
    expect(uit.inhoudSnapshot).toBeNull();
    expect(uit.geadresseerdeSnapshot).toBeNull();
  });

  it('respecteert bestaande overslaanbeslissingen zonder schrijfintentie', () => {
    const plan = basisPlan();
    plan.actie = 'overslaan';
    plan.reden = 'Al verstuurd.';

    const uit = bepaalProductiekernBriefVoorbereiding({ signaal, plan });

    expect(uit.actie).toBe('overslaan');
    expect(uit.reden).toBe('Al verstuurd.');
    expect(uit.inhoudSnapshot).toBeNull();
  });
});
