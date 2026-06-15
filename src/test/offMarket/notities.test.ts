import { describe, it, expect } from 'vitest';
import { splitsNotities } from '@/lib/offMarket/notities';

describe('splitsNotities', () => {
  it('lege input', () => {
    expect(splitsNotities(null)).toEqual({ dossier: '', technisch: '' });
    expect(splitsNotities('')).toEqual({ dossier: '', technisch: '' });
  });
  it('menselijke notitie blijft dossier', () => {
    const r = splitsNotities('Eigenaar gebeld 12-06, geen interesse op dit moment.');
    expect(r.dossier).toContain('Eigenaar gebeld');
    expect(r.technisch).toBe('');
  });
  it('auto-import regels worden technisch', () => {
    const tekst = [
      '[auto-import] score=72',
      '[auto-import 2026-06-10] extra bron: bekendmaking – 1234',
      'Telefoongesprek met makelaar gepland.',
    ].join('\n');
    const r = splitsNotities(tekst);
    expect(r.dossier).toBe('Telefoongesprek met makelaar gepland.');
    expect(r.technisch).toContain('[auto-import] score=72');
    expect(r.technisch).toContain('[auto-import 2026-06-10]');
  });
  it('alleen technische regels → leeg dossier', () => {
    const r = splitsNotities('[auto-import] score=55');
    expect(r.dossier).toBe('');
    expect(r.technisch).toContain('score=55');
  });
});
