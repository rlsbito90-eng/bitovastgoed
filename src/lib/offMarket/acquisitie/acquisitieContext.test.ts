import { describe, expect, it } from 'vitest';
import {
  bepaalAcquisitieWerkcontext,
  tabVoorWerkrondeBron,
} from './acquisitieContext';

describe('acquisitie contextmapping', () => {
  it('routeert Onderzoeken naar Kadaster & eigenaar', () => {
    expect(bepaalAcquisitieWerkcontext({ subfilter: 'onderzoeken' })).toEqual({
      tab: 'kadaster',
      bron: 'onderzoeken',
      naam: 'Onderzoeken',
    });
  });

  it('routeert Brief voorbereiden naar Brieven & opvolging', () => {
    expect(bepaalAcquisitieWerkcontext({ subfilter: 'brief_voorbereiden' }).tab).toBe('brieven');
  });

  it('routeert te printen en te posten naar Brieven & opvolging met specifieke bron', () => {
    expect(bepaalAcquisitieWerkcontext({
      subfilter: 'printen_posten',
      printPost: 'te_printen',
    })).toMatchObject({ tab: 'brieven', bron: 'te_printen' });

    expect(bepaalAcquisitieWerkcontext({
      subfilter: 'printen_posten',
      printPost: 'te_posten',
    })).toMatchObject({ tab: 'brieven', bron: 'te_posten' });
  });

  it('routeert Opvolgen naar Brieven & opvolging', () => {
    expect(bepaalAcquisitieWerkcontext({ subfilter: 'opvolgen' })).toEqual({
      tab: 'brieven',
      bron: 'opvolgen',
      naam: 'Opvolgen',
    });
  });

  it('behoudt oude generieke werkrondebronnen en routeert die veilig naar brieven', () => {
    expect(tabVoorWerkrondeBron('werkbak')).toBe('brieven');
    expect(tabVoorWerkrondeBron('handmatig')).toBe('brieven');
    expect(tabVoorWerkrondeBron('onderzoeken')).toBe('kadaster');
  });
});
