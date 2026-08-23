import { describe, expect, it } from 'vitest';
import { beoordeelExperiment, type ExperimentVariantRij } from '@/lib/acquisitie/experimentPlaybook';

const variant = (code: string, verzonden: number, sellerPct: number, algemeenPct = sellerPct): ExperimentVariantRij => ({
  sleutel: `x:${code}`,
  label: `Variant ${code}`,
  variantCode: code,
  isControl: code === 'A',
  verzonden,
  reacties: 0,
  positieveReacties: Math.round((algemeenPct / 100) * verzonden),
  kwalitatieveReacties: Math.round((algemeenPct / 100) * verzonden),
  gekwalificeerdeLeads: 0,
  responspercentage: 0,
  positieveResponspercentage: algemeenPct,
  kwalitatieveResponspercentage: algemeenPct,
  gekwalificeerdeLeadPercentage: 0,
  verkoperReacties: Math.round((sellerPct / 100) * verzonden),
  kwalitatieveVerkoperReacties: Math.round((sellerPct / 100) * verzonden),
  gekwalificeerdeVerkoperLeads: 0,
  koperReacties: 0,
  gekwalificeerdeKoperLeads: 0,
  kwalitatieveVerkoperResponspercentage: sellerPct,
  gekwalificeerdeVerkoperLeadPercentage: 0,
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

  it('markeert pas bij streefvolume en duidelijke uplift in kwalitatieve verkopersrespons een kandidaat-winnaar', () => {
    const model = beoordeelExperiment({ ...basis, varianten: [variant('A', 80, 5), variant('B', 80, 9)] });
    expect(model.status).toBe('kandidaat_winnaar');
    expect(model.kandidaatVariantCode).toBe('B');
    expect(model.checks.streefvolume).toBe(true);
  });

  it('laat veel koperrespons niet winnen wanneer verkopersrespons achterblijft', () => {
    const model = beoordeelExperiment({ ...basis, varianten: [variant('A', 80, 6, 6), variant('B', 80, 4, 15)] });
    expect(model.status).toBe('beslismoment');
    expect(model.kandidaatVariantCode).toBeNull();
  });

  it('promoveert niets wanneer het seller-kwaliteitsverschil te klein is', () => {
    const model = beoordeelExperiment({ ...basis, varianten: [variant('A', 80, 5), variant('B', 80, 6)] });
    expect(model.status).toBe('beslismoment');
    expect(model.kandidaatVariantCode).toBeNull();
  });
});
