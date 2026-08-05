import { describe, expect, it } from 'vitest';
import { bouwAcquisitieResponsReadModel } from './acquisitieResponsUitkomst';

describe('bouwAcquisitieResponsReadModel', () => {
  it('laat de briefreeks doorlopen bij geen reactie', () => {
    const model = bouwAcquisitieResponsReadModel({ status: 'geen_reactie' });
    expect(model.stoptBriefreeks).toBe(false);
    expect(model.vervolgactie).toBe('geen');
  });

  it('stopt de briefreeks en vraagt beoordeling bij een nog ongeduide reactie', () => {
    const model = bouwAcquisitieResponsReadModel({
      status: 'reactie_ontvangen',
      ontvangenOp: '2026-08-05',
    });
    expect(model.stoptBriefreeks).toBe(true);
    expect(model.vereistHandmatigeBeoordeling).toBe(true);
    expect(model.vervolgactie).toBe('belafspraak_plannen');
  });

  it('stuurt interesse naar kwalificatie zonder automatisch dossierbesluit', () => {
    const model = bouwAcquisitieResponsReadModel({
      status: 'interesse',
      uitkomst: 'Eigenaar staat open voor gesprek',
    });
    expect(model.vervolgactie).toBe('kwalificeren');
    expect(model.vereistHandmatigeBeoordeling).toBe(false);
    expect(model.veiligheidsmelding).toContain('bewuste bevestiging');
  });

  it('stuurt later contact naar een gedateerde opvolgactie', () => {
    const model = bouwAcquisitieResponsReadModel({
      status: 'later_contact',
      uitkomst: 'Na de zomer opnieuw bellen',
      volgendeActieOp: '2026-09-15',
    });
    expect(model.vervolgactie).toBe('later_opvolgen');
    expect(model.volgendeActieOp).toBe('2026-09-15');
  });

  it('markeert een onjuiste geadresseerde als herstelactie', () => {
    const model = bouwAcquisitieResponsReadModel({
      status: 'onjuiste_geadresseerde',
      uitkomst: 'Brief retour ontvangen',
    });
    expect(model.stoptBriefreeks).toBe(true);
    expect(model.vervolgactie).toBe('geadresseerde_herstellen');
  });
});
