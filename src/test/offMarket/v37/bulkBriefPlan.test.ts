import { describe, it, expect } from 'vitest';
import {
  bouwKandidatenVoorSignaal, bouwBriefPlan, samenvatPlan,
} from '@/lib/offMarket/acquisitie/bulkBrief';
import { sorteerPrintItems } from '@/lib/offMarket/acquisitie/printVolgorde';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

const signaal: OffMarketSignaal = {
  id: 'sig-1',
  status: 'actief',
  type_signaal: 'vergunning',
  titel: 'Testpand',
  adres: 'Voorbeeldstraat 1',
  postcode: '1000 AA',
  plaats: 'Testplaats',
  eigenaar_naam: 'A. Een',
  eigenaar_bedrijfsnaam: null,
  eigenaar_verzendadres: 'Verstraat 2\n1000 BB Testplaats',
} as any;

function brief(overrides: Partial<OffMarketBrief>): OffMarketBrief {
  const naam = overrides.eigenaar_naam ?? null;
  const bedrijf = overrides.eigenaar_bedrijfsnaam ?? null;
  const adres = overrides.verzendadres ?? null;
  const id = overrides.id ?? `b-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    signaal_id: 'sig-1',
    eigenaar_naam: naam,
    eigenaar_bedrijfsnaam: bedrijf,
    verzendadres: adres,
    objectadres: null,
    objectomschrijving: null,
    aanhef: 'Geachte heer/mevrouw,',
    onderwerp: 'Onderwerp',
    brieftekst: 'tekst',
    status: 'concept',
    verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'post',
    campagne_stap: 'brief_1',
    geadresseerde_key: geadresseerdeKey({
      id, eigenaar_naam: naam, eigenaar_bedrijfsnaam: bedrijf, verzendadres: adres,
    } as any),
    verzendstatus: 'concept',
    ...overrides,
  } as OffMarketBrief;
}

describe('bulkBrief — kandidaten', () => {
  it('één signaal met twee geadresseerden levert twee selecteerbare items', () => {
    const b1 = brief({
      id: 'b1',
      eigenaar_naam: 'Eigenaar Een',
      verzendadres: 'Eenstraat 1\n1011 AA Amsterdam',
    });
    const b2 = brief({
      id: 'b2',
      eigenaar_naam: 'Eigenaar Twee',
      verzendadres: 'Tweestraat 2\n1012 BB Amsterdam',
    });
    const k = bouwKandidatenVoorSignaal(signaal, [b1, b2]);
    expect(k).toHaveLength(2);
    expect(k.every(x => x.geschikt)).toBe(true);
  });

  it('oude conceptversies verdubbelen de geadresseerde niet', () => {
    const oud = brief({
      id: 'oud',
      eigenaar_naam: 'Eigenaar Een',
      verzendadres: 'Eenstraat 1\n1011 AA Amsterdam',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    const nieuw = brief({
      id: 'nieuw',
      eigenaar_naam: 'Eigenaar Een',
      verzendadres: 'Eenstraat 1\n1011 AA Amsterdam',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    });
    const k = bouwKandidatenVoorSignaal(signaal, [oud, nieuw]);
    expect(k).toHaveLength(1);
  });
});

describe('bulkBrief — plan', () => {
  const k = {
    signaalId: 'sig-1',
    geadresseerdeKey: 'k1',
    naam: 'X', bedrijfsnaam: null, verzendadres: 'Straat 1\n1000 AA Plaats',
    geschikt: true, blokkade: null, hints: [],
  };

  it('hergebruikt bestaand concept met dezelfde sleutel', () => {
    const b = brief({
      id: 'c1', campagne_stap: 'brief_1', geadresseerde_key: 'k1', status: 'concept',
    });
    const plan = bouwBriefPlan({ kandidaten: [k], brieven: [b], campagneStap: 'brief_1' });
    expect(plan[0].actie).toBe('hergebruiken');
    expect(plan[0].bestaandeBrief?.id).toBe('c1');
  });

  it('slaat verstuurde brief met dezelfde sleutel over', () => {
    const b = brief({
      id: 'v1', campagne_stap: 'brief_1', geadresseerde_key: 'k1', status: 'verstuurd',
    });
    const plan = bouwBriefPlan({ kandidaten: [k], brieven: [b], campagneStap: 'brief_1' });
    expect(plan[0].actie).toBe('overslaan');
    expect(plan[0].reden).toMatch(/verstuurd/i);
  });

  it('brief 2/3 gebruikt campagne_stap, niet recordvolgorde', () => {
    const b1 = brief({ id: 'b1', campagne_stap: 'brief_1', geadresseerde_key: 'k1', status: 'verstuurd' });
    // Brief 2 nog niet gemaakt → kandidaat → aanmaken
    const plan = bouwBriefPlan({ kandidaten: [k], brieven: [b1], campagneStap: 'brief_2' });
    expect(plan[0].actie).toBe('aanmaken');
  });

  it('ongeschikte kandidaten worden overgeslagen met reden', () => {
    const ong = { ...k, geschikt: false, blokkade: 'Postadres is onvolledig.' };
    const plan = bouwBriefPlan({ kandidaten: [ong], brieven: [], campagneStap: 'brief_1' });
    expect(plan[0].actie).toBe('overslaan');
    expect(plan[0].reden).toMatch(/postadres/i);
  });

  it('samenvatting telt uniek per signaal+geadresseerde', () => {
    const plan = bouwBriefPlan({ kandidaten: [k, k], brieven: [], campagneStap: 'brief_1' });
    const s = samenvatPlan(plan);
    expect(s.uniekeGeadresseerden).toBe(1);
    expect(s.uniekeSignalen).toBe(1);
  });
});

describe('printVolgorde — stabiele volgorde', () => {
  it('sorteert eerst op toegevoegd_op, dan key, dan stap', () => {
    const r = sorteerPrintItems([
      { signaalId: 's2', toegevoegdOp: '2026-02-01', geadresseerdeKey: 'b', campagneStap: 'brief_1' },
      { signaalId: 's1', toegevoegdOp: '2026-01-01', geadresseerdeKey: 'b', campagneStap: 'brief_2' },
      { signaalId: 's1', toegevoegdOp: '2026-01-01', geadresseerdeKey: 'a', campagneStap: 'brief_1' },
      { signaalId: 's1', toegevoegdOp: '2026-01-01', geadresseerdeKey: 'b', campagneStap: 'brief_1' },
    ]);
    expect(r.map(x => `${x.signaalId}|${x.geadresseerdeKey}|${x.campagneStap}`)).toEqual([
      's1|a|brief_1',
      's1|b|brief_1',
      's1|b|brief_2',
      's2|b|brief_1',
    ]);
  });

  it('is mutatievrij', () => {
    const inp = [{ signaalId: 'a', toegevoegdOp: '2026-01-01', geadresseerdeKey: 'x' }];
    const r = sorteerPrintItems(inp);
    expect(r).not.toBe(inp);
  });
});
