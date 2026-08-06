import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieNaPostActiebediening } from './acquisitieNaPostActiebediening';
import { routeerAcquisitieNaPostHerstelactie } from './acquisitieNaPostActieRouter';

function bediening(
  overrides: Partial<AcquisitieNaPostActiebediening> = {},
): AcquisitieNaPostActiebediening {
  return {
    actie: 'postregistratie_herstellen',
    label: 'Postregistratie herstellen',
    variant: 'primair',
    zichtbaar: true,
    uitgeschakeld: false,
    bevestigingNodig: true,
    operationKey: null,
    blokkeertVervolg: true,
    ...overrides,
  };
}

function handlers() {
  return {
    herstelPostregistratie: vi.fn(async () => undefined),
    herstelOpvolging: vi.fn(async () => undefined),
    herstelDossierbijwerking: vi.fn(async (_operationKey: string) => undefined),
    herstelAudit: vi.fn(async (_operationKey: string) => undefined),
  };
}

describe('routeerAcquisitieNaPostHerstelactie', () => {
  it('routeert postregistratie naar exact één handler', async () => {
    const h = handlers();

    await routeerAcquisitieNaPostHerstelactie({ bediening: bediening(), handlers: h });

    expect(h.herstelPostregistratie).toHaveBeenCalledTimes(1);
    expect(h.herstelOpvolging).not.toHaveBeenCalled();
    expect(h.herstelDossierbijwerking).not.toHaveBeenCalled();
    expect(h.herstelAudit).not.toHaveBeenCalled();
  });

  it('geeft de dossier-operation key uitsluitend aan dossierherstel door', async () => {
    const h = handlers();

    await routeerAcquisitieNaPostHerstelactie({
      bediening: bediening({
        actie: 'dossierbijwerking_herstellen',
        label: 'Dossierstatus herstellen',
        operationKey: 'dossier:1',
      }),
      handlers: h,
    });

    expect(h.herstelDossierbijwerking).toHaveBeenCalledWith('dossier:1');
    expect(h.herstelAudit).not.toHaveBeenCalled();
  });

  it('geeft de audit-operation key uitsluitend aan auditherstel door', async () => {
    const h = handlers();

    await routeerAcquisitieNaPostHerstelactie({
      bediening: bediening({
        actie: 'audit_herstellen',
        label: 'Auditregistratie herstellen',
        variant: 'secundair',
        bevestigingNodig: false,
        operationKey: 'audit:na-post:1',
        blokkeertVervolg: false,
      }),
      handlers: h,
    });

    expect(h.herstelAudit).toHaveBeenCalledWith('audit:na-post:1');
    expect(h.herstelDossierbijwerking).not.toHaveBeenCalled();
  });

  it('weigert verborgen, uitgeschakelde en ontbrekende acties', async () => {
    const h = handlers();

    await expect(routeerAcquisitieNaPostHerstelactie({
      bediening: bediening({ zichtbaar: false }),
      handlers: h,
    })).rejects.toThrow('niet uitvoerbaar');

    await expect(routeerAcquisitieNaPostHerstelactie({
      bediening: bediening({ uitgeschakeld: true }),
      handlers: h,
    })).rejects.toThrow('niet uitvoerbaar');

    await expect(routeerAcquisitieNaPostHerstelactie({
      bediening: bediening({ actie: 'geen', variant: 'verborgen' }),
      handlers: h,
    })).rejects.toThrow('niet uitvoerbaar');

    expect(h.herstelPostregistratie).not.toHaveBeenCalled();
  });

  it('weigert dossier- en auditherstel zonder operation key', async () => {
    const h = handlers();

    await expect(routeerAcquisitieNaPostHerstelactie({
      bediening: bediening({ actie: 'dossierbijwerking_herstellen' }),
      handlers: h,
    })).rejects.toThrow('operation key');

    await expect(routeerAcquisitieNaPostHerstelactie({
      bediening: bediening({ actie: 'audit_herstellen', operationKey: '   ' }),
      handlers: h,
    })).rejects.toThrow('operation key');
  });
});
