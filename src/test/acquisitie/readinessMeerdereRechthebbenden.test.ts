import { describe, expect, it } from 'vitest';
import { bepaalSignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import { pasCanoniekeRechthebbendenToeOpReadiness } from '@/lib/offMarket/acquisitie/readinessRechthebbenden';

describe('readiness met canonieke meerdere rechthebbenden', () => {
  it('telt drie erfpachters automatisch als drie geadresseerden en gaat naar brief voorbereiden', () => {
    const signaal = {
      id: 's1',
      status: 'eigenaar_gevonden',
      eigenaarstatus: 'gevonden',
      eigenaar_bekend: true,
      eigenaar_controle_nodig: false,
      eigenaar_rechtssituatie: 'erfpacht',
      eigenaar_rechthebbenden: [
        { bedrijfsnaam: 'Be Find Bad B.V.', kvk: '81221010', aandeel: '1/2', verzendadres: 'Laan van Nieuw Oosteinde 245\n2274 GD Voorburg' },
        { bedrijfsnaam: 'Lairesse Vastgoed B.V.', kvk: '64429423', aandeel: '1/4', verzendadres: 'Bachstraat 15\n1077 GE Amsterdam' },
        { bedrijfsnaam: 'Four Stones Group B.V.', kvk: '91411203', aandeel: '1/4', verzendadres: 'Marnixstraat 285-A\n1015 WL Amsterdam' },
      ],
    } as any;
    const basis = bepaalSignaalReadiness({ signaal, brieven: [] });
    const r = pasCanoniekeRechthebbendenToeOpReadiness(signaal, [], basis);

    expect(r.fase).toBe('brief_voorbereiden');
    expect(r.geadresseerden).toHaveLength(3);
    expect(r.telling.totaal).toBe(3);
    expect(r.telling.metVolledigAdres).toBe(3);
    expect(r.geadresseerden.map((g) => g.bedrijfsnaam)).toEqual([
      'Be Find Bad B.V.', 'Lairesse Vastgoed B.V.', 'Four Stones Group B.V.',
    ]);
  });

  it('blijft adres ontbreekt als één rechthebbende geen compleet adres heeft', () => {
    const signaal = {
      id: 's2', status: 'eigenaar_gevonden', eigenaarstatus: 'gevonden', eigenaar_bekend: true,
      eigenaar_controle_nodig: false,
      eigenaar_rechthebbenden: [
        { bedrijfsnaam: 'A B.V.', kvk: '11111111', verzendadres: 'Dam 1\n1012 JS Amsterdam' },
        { bedrijfsnaam: 'B B.V.', kvk: '22222222', verzendadres: null },
      ],
    } as any;
    const basis = bepaalSignaalReadiness({ signaal, brieven: [] });
    const r = pasCanoniekeRechthebbendenToeOpReadiness(signaal, [], basis);
    expect(r.fase).toBe('adres_ontbreekt');
    expect(r.geadresseerden).toHaveLength(2);
  });

  it('laat een echte controleflag leidend', () => {
    const signaal = {
      id: 's3', status: 'eigenaar_gevonden', eigenaar_controle_nodig: true,
      eigenaar_controle_reden: 'Conflict met handmatige data',
      eigenaar_rechthebbenden: [{ bedrijfsnaam: 'A B.V.', verzendadres: 'Dam 1\n1012 JS Amsterdam' }],
    } as any;
    const basis = bepaalSignaalReadiness({ signaal, brieven: [] });
    const r = pasCanoniekeRechthebbendenToeOpReadiness(signaal, [], basis);
    expect(r.fase).toBe('eigenaar_controleren');
  });
});
