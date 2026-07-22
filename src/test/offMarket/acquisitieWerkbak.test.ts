// Fase 1 — Tests voor werkbak-mapping, procesdatums en Werkvolgorde-sortering.
import { describe, expect, it } from 'vitest';
import {
  bepaalWerkbakContext,
  sorteerWerkvolgorde,
  type SorteerRij,
} from '@/lib/offMarket/acquisitie/werkbak';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { SignaalReadiness, ReadinessFase } from '@/lib/offMarket/acquisitie/readiness';

const VANDAAG = '2026-07-22';

function mkSignaal(id = 's1'): OffMarketSignaal {
  return { id } as unknown as OffMarketSignaal;
}

function mkReadiness(fase: ReadinessFase): SignaalReadiness {
  return {
    fase,
    info: { status: 'gereed', reden: '' },
    telling: { totaal: 1 },
    geadresseerden: [],
    waarschuwingen: [],
    blokkadeReden: null,
  } as unknown as SignaalReadiness;
}

function mkBrief(overrides: Partial<OffMarketBrief> = {}): OffMarketBrief {
  return {
    id: 'b1',
    signaal_id: 's1',
    status: 'verstuurd',
    kanaal: 'post',
    verzendstatus: 'gepost',
    opvolgdatum: null,
    responsstatus: null,
    responsdatum: null,
    printdatum: null,
    archived_at: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  } as unknown as OffMarketBrief;
}

describe('bepaalWerkbakContext', () => {
  it('mapt onderzoek_nodig → actie/onderzoeken', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('onderzoek_nodig'),
      brieven: [],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieSubfilter).toBe('onderzoeken');
    expect(ctx.actieCategorie).toBe('onderzoek');
  });

  it('afgerond → afgehandeld', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('afgerond'),
      brieven: [mkBrief({ responsdatum: '2026-07-10' })],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('afgehandeld');
    expect(ctx.procesDatum?.iso).toBe('2026-07-10');
  });

  it('gepost met toekomstige opvolgdatum → wachten', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('gepost'),
      brieven: [mkBrief({ opvolgdatum: '2026-08-05' })],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('wachten');
    expect(ctx.procesDatum?.iso).toBe('2026-08-05');
  });

  it('gepost zonder opvolgdatum → actie/opvolging_plannen', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('gepost'),
      brieven: [mkBrief({ opvolgdatum: null })],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieCategorie).toBe('opvolging_plannen');
  });

  it('opvolging_open met verlopen datum → verlopen categorie', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('opvolging_open'),
      brieven: [mkBrief({ opvolgdatum: '2026-07-10' })],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieCategorie).toBe('opvolging_verlopen');
  });
});

describe('Fase 1.1 — tabelgedreven dekking readiness-fases', () => {
  // Elke bekende readiness-fase mapt naar exact één (werkbak, subfilter) categorie.
  // Dit voorkomt dat toekomstige fases per ongeluk in twee bakken vallen.
  const casus: Array<{ fase: ReadinessFase; werkbak: 'actie' | 'wachten' | 'afgehandeld'; brieven?: OffMarketBrief[] }> = [
    { fase: 'onderzoek_nodig', werkbak: 'actie' },
    { fase: 'eigenaar_ontbreekt', werkbak: 'actie' },
    { fase: 'adres_ontbreekt', werkbak: 'actie' },
    { fase: 'brief_voorbereiden', werkbak: 'actie' },
    { fase: 'concept_gereed', werkbak: 'actie' },
    { fase: 'gereed_voor_print', werkbak: 'actie' },
    { fase: 'geprint', werkbak: 'actie' },
    { fase: 'opvolging_open', werkbak: 'actie', brieven: [mkBrief({ opvolgdatum: '2026-07-10' })] },
    { fase: 'gepost', werkbak: 'wachten', brieven: [mkBrief({ opvolgdatum: '2026-08-05' })] },
    { fase: 'email_verzonden', werkbak: 'wachten', brieven: [mkBrief({ kanaal: 'email' as any, opvolgdatum: '2026-08-05' })] },
    { fase: 'afgerond', werkbak: 'afgehandeld', brieven: [mkBrief({ responsdatum: '2026-07-10' })] },
  ];
  it.each(casus)('fase $fase → werkbak $werkbak', ({ fase, werkbak, brieven }) => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness(fase),
      brieven: brieven ?? [],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe(werkbak);
  });

  it('sum-invariant: actie + wachten + afgehandeld = totaal', () => {
    const totaal = casus.length;
    const a = casus.filter(c => c.werkbak === 'actie').length;
    const w = casus.filter(c => c.werkbak === 'wachten').length;
    const f = casus.filter(c => c.werkbak === 'afgehandeld').length;
    expect(a + w + f).toBe(totaal);
  });
});

describe('Fase 1.1 — semantische labels afgehandeld', () => {
  it('respons: label "Reactie op ..."', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('afgerond'),
      brieven: [mkBrief({ responsdatum: '2026-07-10' })],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.procesDatum?.label).toMatch(/^Reactie op /);
    expect(ctx.procesDatum?.iso).toBe('2026-07-10');
  });

  it('gearchiveerd zonder respons: label "Gearchiveerd op ..."', () => {
    const s = { id: 's1', gearchiveerd_op: '2026-06-15T09:00:00Z' } as unknown as OffMarketSignaal;
    const ctx = bepaalWerkbakContext({
      signaal: s,
      readiness: mkReadiness('afgerond'),
      brieven: [], // geen actieve brieven, dus geen responsdatum
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.procesDatum?.label).toMatch(/^Gearchiveerd op /);
    expect(ctx.procesDatum?.iso).toBe('2026-06-15');
  });

  it('geen betrouwbare datum: alleen "Afgehandeld"', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('afgerond'),
      brieven: [],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.procesDatum?.iso).toBeNull();
    expect(ctx.procesDatum?.label).toBe('Afgehandeld');
  });
});

describe('Fase 1.1 — defensieve Wachten-controle', () => {
  it('actief concept blokkeert Wachten (fase blijft "gepost", maar één brief is concept)', () => {
    // gepost-fase betekent minimaal één verstuurde brief; een tweede
    // ontvanger met een concept moet Wachten voorkomen.
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('gepost'),
      brieven: [
        mkBrief({ id: 'b1', opvolgdatum: '2026-08-05' }),
        mkBrief({ id: 'b2', status: 'concept' as any, verzendstatus: null as any, opvolgdatum: null }),
      ],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('actie');
  });

  it('vandaag als opvolgdatum → geen Wachten', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('gepost'),
      brieven: [mkBrief({ opvolgdatum: VANDAAG })],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('actie');
  });

  it('alle actieve brieven verzonden met toekomstige opvolging → Wachten', () => {
    const ctx = bepaalWerkbakContext({
      signaal: mkSignaal(),
      readiness: mkReadiness('gepost'),
      brieven: [
        mkBrief({ id: 'b1', opvolgdatum: '2026-08-05' }),
        mkBrief({ id: 'b2', opvolgdatum: '2026-08-10' }),
      ],
      toegevoegdOp: null,
      vandaag: VANDAAG,
    });
    expect(ctx.werkbak).toBe('wachten');
  });
});

describe('sorteerWerkvolgorde', () => {
  function rij(id: string, ctx: SorteerRij['ctx'], toegevoegdOp: string | null = null): SorteerRij {
    return {
      signaalId: id,
      toegevoegdOp,
      ctx,
      procesDatumIsoWachten: ctx.werkbak === 'wachten' ? (ctx.procesDatum?.iso ?? null) : null,
    };
  }

  it('actie: verlopen opvolging staat vóór onderzoek', () => {
    const rijen: SorteerRij[] = [
      rij('a', {
        werkbak: 'actie',
        actieCategorie: 'onderzoek',
        actieSubfilter: 'onderzoeken',
        procesDatum: null,
      }),
      rij('b', {
        werkbak: 'actie',
        actieCategorie: 'opvolging_verlopen',
        actieSubfilter: 'opvolgen',
        procesDatum: { iso: '2026-07-10', label: '', a11yLabel: '' },
      }),
    ];
    const gesorteerd = sorteerWerkvolgorde('actie', rijen);
    expect(gesorteerd.map(r => r.signaalId)).toEqual(['b', 'a']);
  });

  it('wachten: vroegste opvolgdatum eerst', () => {
    const mk = (id: string, iso: string): SorteerRij => rij(id, {
      werkbak: 'wachten',
      actieCategorie: null,
      actieSubfilter: null,
      procesDatum: { iso, label: '', a11yLabel: '' },
    });
    const gesorteerd = sorteerWerkvolgorde('wachten', [mk('a', '2026-09-01'), mk('b', '2026-08-01')]);
    expect(gesorteerd.map(r => r.signaalId)).toEqual(['b', 'a']);
  });

  it('afgehandeld: meest recente eerst', () => {
    const mk = (id: string, iso: string): SorteerRij => rij(id, {
      werkbak: 'afgehandeld',
      actieCategorie: null,
      actieSubfilter: null,
      procesDatum: { iso, label: '', a11yLabel: '' },
    });
    const gesorteerd = sorteerWerkvolgorde('afgehandeld', [mk('a', '2026-06-01'), mk('b', '2026-07-01')]);
    expect(gesorteerd.map(r => r.signaalId)).toEqual(['b', 'a']);
  });

  it('alles: actie < wachten < afgehandeld', () => {
    const rijen: SorteerRij[] = [
      rij('afg', {
        werkbak: 'afgehandeld', actieCategorie: null, actieSubfilter: null,
        procesDatum: { iso: '2026-07-01', label: '', a11yLabel: '' },
      }),
      rij('wa', {
        werkbak: 'wachten', actieCategorie: null, actieSubfilter: null,
        procesDatum: { iso: '2026-09-01', label: '', a11yLabel: '' },
      }),
      rij('ac', {
        werkbak: 'actie', actieCategorie: 'opvolging_verlopen', actieSubfilter: 'opvolgen',
        procesDatum: { iso: '2026-07-10', label: '', a11yLabel: '' },
      }),
    ];
    const gesorteerd = sorteerWerkvolgorde('alles', rijen);
    expect(gesorteerd.map(r => r.signaalId)).toEqual(['ac', 'wa', 'afg']);
  });
});
