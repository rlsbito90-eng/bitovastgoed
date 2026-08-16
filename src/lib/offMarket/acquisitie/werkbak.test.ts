import { describe, expect, it } from 'vitest';
import {
  bepaalWerkbakContext,
  sorteerWerkvolgorde,
  type WerkbakContext,
} from '@/lib/offMarket/acquisitie/werkbak';

const vandaag = '2026-08-01';

function readiness(fase: string) {
  return { fase } as any;
}

function signaal(extra: Record<string, unknown> = {}) {
  return { id: 'sig-1', ...extra } as any;
}

function brief(extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    signaal_id: 'sig-1',
    kanaal: 'post',
    status: 'concept',
    verzendstatus: null,
    archived_at: null,
    created_at: '2026-07-20T10:00:00Z',
    ...extra,
  } as any;
}

function bepaal(fase: string, brieven: any[] = [], extraSignaal: Record<string, unknown> = {}) {
  return bepaalWerkbakContext({
    signaal: signaal(extraSignaal),
    readiness: readiness(fase),
    brieven,
    toegevoegdOp: '2026-07-01T10:00:00Z',
    vandaag,
  });
}

describe('bepaalWerkbakContext', () => {
  it.each(['onderzoek_nodig', 'eigenaar_ontbreekt'])(
    'plaatst %s in Onderzoeken',
    (fase) => {
      const ctx = bepaal(fase);
      expect(ctx).toMatchObject({
        werkbak: 'actie',
        actieCategorie: 'onderzoek',
        actieSubfilter: 'onderzoeken',
      });
      expect(ctx.procesDatum?.label).toBe('Nog niet onderzocht');
    },
  );

  it('plaatst adres_ontbreekt in Adres achterhalen', () => {
    const ctx = bepaal('adres_ontbreekt');
    expect(ctx).toMatchObject({
      werkbak: 'actie',
      actieCategorie: 'adres_achterhalen',
      actieSubfilter: 'adres_achterhalen',
    });
    expect(ctx.procesDatum?.label).toBe('Adres achterhalen');
  });

  it('plaatst een signaal zonder concept in Brief voorbereiden', () => {
    const ctx = bepaal('brief_voorbereiden');
    expect(ctx).toMatchObject({
      werkbak: 'actie',
      actieCategorie: 'brief_voorbereiden',
      actieSubfilter: 'brief_voorbereiden',
    });
    expect(ctx.procesDatum?.label).toBe('Nog geen concept');
  });

  it('gebruikt de meest recente conceptdatum bij Concept controleren', () => {
    const ctx = bepaal('concept_gereed', [
      brief({ created_at: '2026-07-10T10:00:00Z' }),
      brief({ created_at: '2026-07-25T10:00:00Z' }),
    ]);
    expect(ctx.actieCategorie).toBe('concept_controleren');
    expect(ctx.actieSubfilter).toBe('brief_voorbereiden');
    expect(ctx.procesDatum?.iso).toBe('2026-07-25');
  });

  it('plaatst printklare concepten in Te printen', () => {
    const ctx = bepaal('gereed_voor_print', [
      brief({ created_at: '2026-07-24T10:00:00Z' }),
    ]);
    expect(ctx).toMatchObject({
      werkbak: 'actie',
      actieCategorie: 'gereed_voor_print',
      actieSubfilter: 'printen_posten',
    });
    expect(ctx.procesDatum?.iso).toBe('2026-07-24');
  });

  it('plaatst geprinte postbrieven in Te posten en gebruikt de vroegste printdatum', () => {
    const ctx = bepaal('geprint', [
      brief({ verzendstatus: 'geprint', printdatum: '2026-07-28' }),
      brief({ verzendstatus: 'in_envelop', printdatum: '2026-07-26' }),
    ]);
    expect(ctx).toMatchObject({
      werkbak: 'actie',
      actieCategorie: 'geprint_nog_posten',
      actieSubfilter: 'printen_posten',
    });
    expect(ctx.procesDatum?.iso).toBe('2026-07-26');
  });

  it('plaatst uitsluitend verzonden brieven met toekomstige opvolging in Wachten', () => {
    const ctx = bepaal('gepost', [
      brief({ status: 'verstuurd', verzendstatus: 'gepost', opvolgdatum: '2026-08-10' }),
      brief({ status: 'verstuurd', verzendstatus: 'gepost', opvolgdatum: '2026-08-05' }),
    ]);
    expect(ctx.werkbak).toBe('wachten');
    expect(ctx.procesDatum?.iso).toBe('2026-08-05');
    expect(ctx.procesDatum?.label).toContain('Wachten tot');
  });

  it('houdt een gepost signaal in Actie wanneer een opvolgdatum ontbreekt', () => {
    const ctx = bepaal('gepost', [
      brief({ status: 'verstuurd', verzendstatus: 'gepost', opvolgdatum: null }),
    ]);
    expect(ctx).toMatchObject({
      werkbak: 'actie',
      actieCategorie: 'opvolging_plannen',
      actieSubfilter: 'opvolgen',
    });
  });

  it('houdt een gepost signaal in Actie wanneer nog een concept openstaat', () => {
    const ctx = bepaal('gepost', [
      brief({ status: 'verstuurd', verzendstatus: 'gepost', opvolgdatum: '2026-08-10' }),
      brief({ status: 'concept', opvolgdatum: null }),
    ]);
    expect(ctx.werkbak).toBe('actie');
    expect(ctx.actieCategorie).toBe('opvolging_plannen');
  });

  it('classificeert opvolging vandaag afzonderlijk', () => {
    const ctx = bepaal('opvolging_open', [
      brief({ status: 'verstuurd', opvolgdatum: vandaag }),
    ]);
    expect(ctx.actieCategorie).toBe('opvolging_vandaag');
    expect(ctx.procesDatum?.label).toBe('Opvolgen vandaag');
  });

  it('classificeert verlopen opvolging met de vroegste openstaande datum', () => {
    const ctx = bepaal('opvolging_open', [
      brief({ status: 'verstuurd', opvolgdatum: '2026-07-20' }),
      brief({ status: 'verstuurd', opvolgdatum: '2026-07-15' }),
    ]);
    expect(ctx.actieCategorie).toBe('opvolging_verlopen');
    expect(ctx.procesDatum?.iso).toBe('2026-07-15');
  });

  it('gebruikt responsdatum als afrondingsdatum', () => {
    const ctx = bepaal('afgerond', [
      brief({ responsdatum: '2026-07-29T12:00:00Z', responsstatus: 'interesse' }),
    ]);
    expect(ctx.werkbak).toBe('afgehandeld');
    expect(ctx.procesDatum?.iso).toBe('2026-07-29');
    expect(ctx.procesDatum?.label).toContain('Reactie op');
  });

  it('valt voor Afgehandeld terug op gearchiveerd_op, niet op updated_at', () => {
    const ctx = bepaal('afgerond', [], {
      gearchiveerd_op: '2026-07-18T08:00:00Z',
      updated_at: '2026-07-31T23:59:00Z',
    });
    expect(ctx.procesDatum?.iso).toBe('2026-07-18');
    expect(ctx.procesDatum?.label).toContain('Gearchiveerd op');
  });
});

function rij(id: string, ctx: WerkbakContext, toegevoegdOp = '2026-07-01') {
  return {
    signaalId: id,
    toegevoegdOp,
    ctx,
    procesDatumIsoWachten: ctx.werkbak === 'wachten' ? ctx.procesDatum?.iso ?? null : null,
  };
}

describe('sorteerWerkvolgorde', () => {
  it('zet binnen Actie verlopen opvolging voor printen, brief en onderzoek', () => {
    const opvolging = bepaal('opvolging_open', [brief({ status: 'verstuurd', opvolgdatum: '2026-07-10' })]);
    const tePosten = bepaal('geprint', [brief({ verzendstatus: 'geprint', printdatum: '2026-07-20' })]);
    const briefVoorbereiden = bepaal('brief_voorbereiden');
    const onderzoek = bepaal('onderzoek_nodig');

    const resultaat = sorteerWerkvolgorde('actie', [
      rij('onderzoek', onderzoek),
      rij('brief', briefVoorbereiden),
      rij('posten', tePosten),
      rij('opvolging', opvolging),
    ]);

    expect(resultaat.map((x) => x.signaalId)).toEqual([
      'opvolging', 'posten', 'brief', 'onderzoek',
    ]);
  });

  it('sorteert Wachten op de eerstvolgende opvolgdatum', () => {
    const vroeg = bepaal('gepost', [brief({ status: 'verstuurd', verzendstatus: 'gepost', opvolgdatum: '2026-08-04' })]);
    const laat = bepaal('gepost', [brief({ status: 'verstuurd', verzendstatus: 'gepost', opvolgdatum: '2026-08-12' })]);
    const resultaat = sorteerWerkvolgorde('wachten', [rij('laat', laat), rij('vroeg', vroeg)]);
    expect(resultaat.map((x) => x.signaalId)).toEqual(['vroeg', 'laat']);
  });

  it('sorteert Afgehandeld op meest recente afrondingsdatum', () => {
    const oud = bepaal('afgerond', [brief({ responsdatum: '2026-07-10' })]);
    const nieuw = bepaal('afgerond', [brief({ responsdatum: '2026-07-30' })]);
    const resultaat = sorteerWerkvolgorde('afgehandeld', [rij('oud', oud), rij('nieuw', nieuw)]);
    expect(resultaat.map((x) => x.signaalId)).toEqual(['nieuw', 'oud']);
  });

  it('sorteert Alles eerst op werkbak en daarna op de werkbakregels', () => {
    const actie = bepaal('onderzoek_nodig');
    const wachten = bepaal('gepost', [brief({ status: 'verstuurd', verzendstatus: 'gepost', opvolgdatum: '2026-08-10' })]);
    const klaar = bepaal('afgerond', [brief({ responsdatum: '2026-07-30' })]);
    const resultaat = sorteerWerkvolgorde('alles', [
      rij('klaar', klaar), rij('wachten', wachten), rij('actie', actie),
    ]);
    expect(resultaat.map((x) => x.signaalId)).toEqual(['actie', 'wachten', 'klaar']);
  });
});
