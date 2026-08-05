import { describe, expect, it } from 'vitest';
import { bepaalAcquisitieWerkstroomCommando } from './acquisitieWerkstroomCommando';
import type { AcquisitieEndToEndReadModel } from './acquisitieEndToEndWerkstroom';

const model = (overrides: Partial<AcquisitieEndToEndReadModel>): AcquisitieEndToEndReadModel => ({
  fase: 'eigenaar_controleren',
  faseLabel: 'Eigenaar en geadresseerde controleren',
  primaireActie: 'Koppel de eigenaar bewust aan een CRM-relatie',
  toelichting: '',
  voortgang: 20,
  geblokkeerd: true,
  veiligheidsmelding: '',
  ...overrides,
});

describe('bepaalAcquisitieWerkstroomCommando', () => {
  it('biedt eerst expliciete CRM-relatiekoppeling aan', () => {
    const commando = bepaalAcquisitieWerkstroomCommando(model({}));
    expect(commando.type).toBe('relatie_koppelen');
    expect(commando.vereistBevestiging).toBe(true);
  });

  it('biedt geadresseerdecontrole aan wanneer de relatie al is gekozen', () => {
    const commando = bepaalAcquisitieWerkstroomCommando(model({
      primaireActie: 'Controleer de geadresseerde en het correspondentieadres',
    }));
    expect(commando.type).toBe('geadresseerde_controleren');
  });

  it('biedt alleen een expliciete briefactie in de briefreeks', () => {
    const commando = bepaalAcquisitieWerkstroomCommando(model({
      fase: 'briefreeks_uitvoeren',
      primaireActie: 'Werk Brief 1 af',
      geblokkeerd: false,
    }));
    expect(commando.type).toBe('brief_voorbereiden');
    expect(commando.toelichting).toContain('niets automatisch');
  });

  it('vereist handmatige beoordeling van respons', () => {
    const commando = bepaalAcquisitieWerkstroomCommando(model({
      fase: 'respons_beoordelen',
      primaireActie: 'Beoordeel de ontvangen reactie',
      geblokkeerd: false,
    }));
    expect(commando.type).toBe('respons_beoordelen');
    expect(commando.vereistBevestiging).toBe(true);
  });

  it('laat de definitieve dossierstatus altijd handmatig bepalen', () => {
    const commando = bepaalAcquisitieWerkstroomCommando(model({
      fase: 'afgerond',
      primaireActie: 'Controleer het dossier',
      voortgang: 100,
      geblokkeerd: false,
    }));
    expect(commando.type).toBe('dossierstatus_bepalen');
    expect(commando.toelichting).toContain('nooit automatisch');
  });
});
