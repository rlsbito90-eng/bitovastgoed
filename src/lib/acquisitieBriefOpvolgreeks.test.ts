import { describe, expect, it } from 'vitest';
import { bouwAcquisitieBriefOpvolgreeks } from './acquisitieBriefOpvolgreeks';

describe('bouwAcquisitieBriefOpvolgreeks', () => {
  it('blokkeert Brief 1 zolang relatie en geadresseerde niet bewust zijn bevestigd', () => {
    const model = bouwAcquisitieBriefOpvolgreeks({
      relatieGekoppeld: false,
      geadresseerdeGecontroleerd: false,
    });

    expect(model.actieveBrief).toBeNull();
    expect(model.stappen.map((stap) => stap.status)).toEqual([
      'niet_beschikbaar',
      'niet_beschikbaar',
      'niet_beschikbaar',
    ]);
  });

  it('maakt alleen Brief 1 actief wanneer de basis gereed is', () => {
    const model = bouwAcquisitieBriefOpvolgreeks({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
    });

    expect(model.actieveBrief).toBe(1);
    expect(model.stappen[0].magVoorbereiden).toBe(true);
    expect(model.stappen[1].status).toBe('niet_beschikbaar');
  });

  it('opent Brief 2 pas na expliciete verzending van Brief 1', () => {
    const model = bouwAcquisitieBriefOpvolgreeks({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
      stappen: [{ briefNummer: 1, verzondenOp: '2026-08-01' }],
    });

    expect(model.actieveBrief).toBe(2);
    expect(model.stappen[0].status).toBe('verzonden');
    expect(model.stappen[1].status).toBe('voorbereiden');
    expect(model.stappen[2].status).toBe('niet_beschikbaar');
  });

  it('stopt de reeks wanneer een reactie als afgerond is geregistreerd', () => {
    const model = bouwAcquisitieBriefOpvolgreeks({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
      reactieAfgerond: true,
      stappen: [{ briefNummer: 1, reactieOntvangenOp: '2026-08-03' }],
    });

    expect(model.afgerond).toBe(true);
    expect(model.actieveBrief).toBeNull();
    expect(model.stappen[0].status).toBe('reactie_ontvangen');
  });

  it('staat expliciet overslaan alleen toe voor een actieve vervolgbrief', () => {
    const model = bouwAcquisitieBriefOpvolgreeks({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
      stappen: [{ briefNummer: 1, verzondenOp: '2026-08-01' }],
    });

    expect(model.stappen[0].magOverslaan).toBe(false);
    expect(model.stappen[1].magOverslaan).toBe(true);
  });
});
