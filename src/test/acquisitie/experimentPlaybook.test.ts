import { describe, expect, it } from 'vitest';
import { beoordeelExperiment, type ExperimentVariantRij } from '@/lib/acquisitie/experimentPlaybook';

const variant = (code: string, verzonden: number, positiefPct: number): ExperimentVariantRij => ({
  sleutel: `x:${code}`,
  label: `Variant ${code}`,
  variantCode: code,
  isControl: code === 'A',
  verzonden,
  reacties: 0,
  positieveReacties: Math.round((positiefPct / 100) * verzonden),
  responspercentage: 0,
  positieveResponspercentage: positiefPct,
});

const basis = {
  sleutel: 'woonvorming:post:brief_1',
  label: 'Woonvorming · Brief 1',
  profiel: 'woonvorming',
  kanaal: 'post',
  campagneStap: 'brief_1',
  eersteVerzending: '2026-07-01T10:00:00Z',
  nu: new Date('2026-08-23T10:00:00Z'),
};

describe('acquisitie experiment playbook', () => {
  it('trekt geen conclusie zolang alleen de controlevariant verkeer heeft', () => {
    const model = beoordeelExperiment({ ...basis, varianten: [variant('A', 80, 5)] });
    expect(model.status).toBe('wacht_op_challenger');
    expect(model.kandidaatVariantCode).toBeNull();
  });

  it('wacht op minimumvolume voordat een beslismoment ontstaat', () => {
    const model = beoordeelExperiment({ ...basis, varianten: [variant('A', 29, 5), variant('B', 29, 10)] });
    expect(model.status).toBe('dataverzameling');
    expect(model.checks.minimumVolume).toBe(false);
  });

  it('markeert pas bij streefvolume en duidelijke uplift een kandidaat-winnaar', () => {
    const model = beoordeelExperiment({ ...basis, varianten: [variant('A', 80, 5), variant('B', 80, 9)] });
    expect(model.status).toBe('kandidaat_winnaar');
    expect(model.kandidaatVariantCode).toBe('B');
    expect(model.checks.streefvolume).toBe(true);
  });

  it('promoveert niets wanneer het verschil te klein is', () => {
    const model = beoordeelExperiment({ ...basis, varianten: [variant('A', 80, 5), variant('B', 80, 6)] });
    expect(model.status).toBe('beslismoment');
    expect(model.kandidaatVariantCode).toBeNull();
  });
});
