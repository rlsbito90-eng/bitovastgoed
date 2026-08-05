import { describe, expect, it } from 'vitest';
import { bouwAcquisitieBriefOpvolgreeks } from './acquisitieBriefOpvolgreeks';
import { bouwAcquisitieResponsReadModel } from './acquisitieResponsUitkomst';
import { bouwAcquisitieEndToEndWerkstroom } from './acquisitieEndToEndWerkstroom';

const briefreeks = (relatieGekoppeld = true, geadresseerdeGecontroleerd = true) =>
  bouwAcquisitieBriefOpvolgreeks({ relatieGekoppeld, geadresseerdeGecontroleerd });

describe('bouwAcquisitieEndToEndWerkstroom', () => {
  it('blokkeert de briefreeks zonder bewuste relatie- en geadresseerdecontrole', () => {
    const model = bouwAcquisitieEndToEndWerkstroom({
      relatieGekoppeld: false,
      geadresseerdeGecontroleerd: false,
      briefreeks: briefreeks(false, false),
      respons: bouwAcquisitieResponsReadModel({ status: 'geen_reactie' }),
    });
    expect(model.fase).toBe('eigenaar_controleren');
    expect(model.geblokkeerd).toBe(true);
  });

  it('stuurt naar de actieve brief zolang geen inhoudelijke reactie bestaat', () => {
    const model = bouwAcquisitieEndToEndWerkstroom({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
      briefreeks: briefreeks(),
      respons: bouwAcquisitieResponsReadModel({ status: 'geen_reactie' }),
    });
    expect(model.fase).toBe('briefreeks_uitvoeren');
    expect(model.primaireActie).toContain('Brief 1');
  });

  it('vereist handmatige beoordeling bij een ongeduide reactie', () => {
    const model = bouwAcquisitieEndToEndWerkstroom({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
      briefreeks: briefreeks(),
      respons: bouwAcquisitieResponsReadModel({ status: 'reactie_ontvangen', ontvangenOp: '2026-08-05' }),
    });
    expect(model.fase).toBe('respons_beoordelen');
  });

  it('stuurt een bevestigde interesse naar kwalificatie', () => {
    const model = bouwAcquisitieEndToEndWerkstroom({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
      briefreeks: briefreeks(),
      respons: bouwAcquisitieResponsReadModel({ status: 'interesse', uitkomst: 'Eigenaar staat open voor gesprek' }),
    });
    expect(model.fase).toBe('vervolgactie_uitvoeren');
    expect(model.primaireActie).toBe('Lead kwalificeren');
  });

  it('rondt alleen de werkstroom af zonder automatische dossierbeslissing', () => {
    const model = bouwAcquisitieEndToEndWerkstroom({
      relatieGekoppeld: true,
      geadresseerdeGecontroleerd: true,
      briefreeks: briefreeks(),
      respons: bouwAcquisitieResponsReadModel({ status: 'geen_interesse', uitkomst: 'Niet verkopen' }),
      vervolgactieAfgerond: true,
    });
    expect(model.fase).toBe('afgerond');
    expect(model.veiligheidsmelding).toContain('geen dossierstatus automatisch');
  });
});
