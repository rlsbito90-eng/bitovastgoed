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
