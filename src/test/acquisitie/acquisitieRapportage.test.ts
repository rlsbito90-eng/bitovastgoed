import { describe, expect, it } from 'vitest';
import { berekenAcquisitieRapportage } from '@/components/acquisitie/AcquisitieRapportageOverzicht';

function target(extra: Record<string, unknown> = {}) {
  return {
    relatieId: 'rel-1',
    objectId: null,
    status: 'eerste_benadering',
    volgendeActieDatum: '2026-08-10',
    ...extra,
  } as any;
}

describe('berekenAcquisitieRapportage', () => {
  it('berekent reacties, warmte, objectconversie en verlopen acties', () => {
    const rapport = berekenAcquisitieRapportage([
      target({ status: 'eerste_benadering', volgendeActieDatum: '2026-07-20' }),
      target({ status: 'reactie_ontvangen', objectId: null }),
      target({ status: 'potentiele_verkooppositie', objectId: 'obj-1' }),
      target({ status: 'object_aangemaakt', objectId: 'obj-2', volgendeActieDatum: null }),
      target({ status: 'niet_interessant', relatieId: null, volgendeActieDatum: null }),
    ], [], '2026-08-01');

    expect(rapport).toMatchObject({
      targets: 5,
      eigenaarGekoppeld: 4,
      reacties: 3,
      warm: 1,
      objecten: 2,
      openActies: 3,
      verlopenActies: 1,
      conversieReactie: '60%',
      conversieObject: '40%',
    });
  });

  it('telt alleen commissie van actieve deals bij gekoppelde acquisitieobjecten', () => {
    const rapport = berekenAcquisitieRapportage([
      target({ objectId: 'obj-1' }),
      target({ objectId: 'obj-2' }),
    ], [
      { objectId: 'obj-1', fase: 'onderhandeling', commissieBedrag: 100_000 },
      { objectId: 'obj-2', fase: 'afgerond', commissieBedrag: 50_000 },
      { objectId: 'obj-3', fase: 'closing', commissieBedrag: 80_000 },
      { objectId: 'obj-1', fase: 'afgevallen', commissieBedrag: 20_000 },
    ] as any, '2026-08-01');

    expect(rapport.verwachteFeePipeline).toBe(100_000);
  });

  it('geeft geen misleidende percentages bij nul targets', () => {
    const rapport = berekenAcquisitieRapportage([], [], '2026-08-01');
    expect(rapport.conversieReactie).toBe('—');
    expect(rapport.conversieObject).toBe('—');
    expect(rapport.verwachteFeePipeline).toBe(0);
  });
});
