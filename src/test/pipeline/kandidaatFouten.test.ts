import { describe, it, expect } from 'vitest';
import {
  beschrijfKandidaatFout,
  haalFoutcode,
  vatKandidaatResultatenSamen,
} from '@/lib/pipeline/kandidaatFouten';

describe('beschrijfKandidaatFout', () => {
  it('herkent een unique-conflict via error.code', () => {
    const err = Object.assign(new Error('duplicate'), { code: '23505' });
    const info = beschrijfKandidaatFout(err);
    expect(info.duplicaat).toBe(true);
    expect(info.reden).toContain('al gekoppeld of was eerder gekoppeld');
  });

  it('herkent een unique-conflict via de foutmelding als code ontbreekt', () => {
    expect(haalFoutcode(new Error('duplicate key value violates unique constraint "x"'))).toBe('23505');
  });

  it('geeft een rechtenmelding bij 42501', () => {
    const info = beschrijfKandidaatFout(Object.assign(new Error('denied'), { code: '42501' }));
    expect(info.reden).toContain('geen rechten');
    expect(info.duplicaat).toBe(false);
  });

  it('valt terug op een veilige melding zonder SQL-detail', () => {
    const info = beschrijfKandidaatFout(new Error('insert into object_pipeline failed'));
    expect(info.reden).not.toContain('object_pipeline');
    expect(info.duplicaat).toBe(false);
  });
});

describe('vatKandidaatResultatenSamen', () => {
  it('toont de relatienaam plus reden bij één mislukking', () => {
    const s = vatKandidaatResultatenSamen([
      { relatieId: 'r1', naam: 'Joost Eggink · Holtburgh', fout: beschrijfKandidaatFout(Object.assign(new Error('x'), { code: '23505' })) },
    ]);
    expect(s.ok).toBe(0);
    expect(s.foutTekst).toContain('Joost Eggink · Holtburgh');
    expect(s.foutTekst).toContain('al gekoppeld');
    expect(s.magSluiten).toBe(false);
    expect(s.mislukteIds).toEqual(['r1']);
  });

  it('verwerkt successen en houdt mislukte kandidaten geselecteerd', () => {
    const s = vatKandidaatResultatenSamen([
      { relatieId: 'r1', naam: 'A' },
      { relatieId: 'r2', naam: 'B', fout: beschrijfKandidaatFout(Object.assign(new Error('x'), { code: '23503' })) },
    ]);
    expect(s.ok).toBe(1);
    expect(s.successTekst).toBe('1 kandidaat toegevoegd');
    expect(s.fout).toBe(1);
    expect(s.mislukteIds).toEqual(['r2']);
    expect(s.magSluiten).toBe(false);
  });

  it('mag alleen sluiten als alles slaagt', () => {
    const s = vatKandidaatResultatenSamen([
      { relatieId: 'r1', naam: 'A' },
      { relatieId: 'r2', naam: 'B' },
    ]);
    expect(s.successTekst).toBe('2 kandidaten toegevoegd');
    expect(s.foutTekst).toBeUndefined();
    expect(s.magSluiten).toBe(true);
  });
});
