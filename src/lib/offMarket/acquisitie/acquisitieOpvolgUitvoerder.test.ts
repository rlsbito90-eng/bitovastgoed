import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieOpvolgCommando } from './acquisitieOpvolgPlan';
import { voerAcquisitieOpvolgPlanUit } from './acquisitieOpvolgUitvoerder';

function commando(suffix: string): AcquisitieOpvolgCommando {
  return {
    briefId: `brief-${suffix}`,
    briefVersieId: `versie-${suffix}`,
    batchId: 'batch-1',
    actorId: 'actor-1',
    operationKey: `opvolg:post:${suffix}`,
    verzondenOp: '2026-08-06T12:00:00Z',
    opvolgenOp: '2026-08-13T12:00:00Z',
    omschrijving: 'Neem contact op.',
  };
}

describe('voerAcquisitieOpvolgPlanUit', () => {
  it('voert commando’s sequentieel uit en telt resultaten', async () => {
    const volgorde: string[] = [];
    const poort = {
      maakOpvolgtaak: vi.fn(async (input: AcquisitieOpvolgCommando) => {
        volgorde.push(input.operationKey);
      }),
    };

    const resultaat = await voerAcquisitieOpvolgPlanUit({
      commandos: [commando('1'), commando('2')],
      poort,
    });

    expect(volgorde).toEqual(['opvolg:post:1', 'opvolg:post:2']);
    expect(resultaat.geslaagdAantal).toBe(2);
    expect(resultaat.misluktAantal).toBe(0);
  });

  it('gaat verder na een fout en lekt geen vrije foutmelding', async () => {
    const poort = {
      maakOpvolgtaak: vi.fn()
        .mockRejectedValueOnce({ code: 'TEMPORARY_UNAVAILABLE', message: 'adres en details' })
        .mockResolvedValueOnce(undefined),
    };

    const resultaat = await voerAcquisitieOpvolgPlanUit({
      commandos: [commando('1'), commando('2')],
      poort,
    });

    expect(resultaat.uitkomsten).toEqual([
      { operationKey: 'opvolg:post:1', geslaagd: false, foutcode: 'TEMPORARY_UNAVAILABLE' },
      { operationKey: 'opvolg:post:2', geslaagd: true, foutcode: null },
    ]);
    expect(JSON.stringify(resultaat)).not.toContain('adres en details');
  });

  it('normaliseert onveilige foutcodes', async () => {
    const resultaat = await voerAcquisitieOpvolgPlanUit({
      commandos: [commando('1')],
      poort: { maakOpvolgtaak: vi.fn(async () => { throw { code: 'lek met spaties' }; }) },
    });
    expect(resultaat.uitkomsten[0].foutcode).toBe('OPVOLGTAAK_MISLUKT');
  });

  it('weigert lege, dubbele en onbegrenste uitvoering', async () => {
    const poort = { maakOpvolgtaak: vi.fn(async () => undefined) };
    await expect(voerAcquisitieOpvolgPlanUit({ commandos: [], poort }))
      .rejects.toThrow('minimaal één commando');
    await expect(voerAcquisitieOpvolgPlanUit({
      commandos: [commando('1'), commando('1')],
      poort,
    })).rejects.toThrow('Dubbele opvolg-operation key');
    await expect(voerAcquisitieOpvolgPlanUit({
      commandos: Array.from({ length: 1001 }, (_, index) => commando(String(index))),
      poort,
    })).rejects.toThrow('maximaal 1000');
  });
});
