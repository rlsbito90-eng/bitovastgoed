import { describe, expect, it } from 'vitest';
import { bepaalFocusContext } from './focusContext';

describe('bepaalFocusContext', () => {
  it('groepeert onderzoeksfasen onder Onderzoeken', () => {
    expect(bepaalFocusContext('onderzoek_nodig').context).toBe('onderzoeken');
    expect(bepaalFocusContext('eigenaar_ontbreekt').titel).toBe('Onderzoeken');
    expect(bepaalFocusContext('adres_ontbreekt').titel).toBe('Onderzoeken');
  });

  it('onderscheidt brief-, print- en postwerk', () => {
    expect(bepaalFocusContext('brief_voorbereiden').context).toBe('brief_voorbereiden');
    expect(bepaalFocusContext('concept_gereed').context).toBe('te_printen');
    expect(bepaalFocusContext('gereed_voor_print').context).toBe('te_printen');
    expect(bepaalFocusContext('geprint').context).toBe('te_posten');
  });

  it('groepeert verzonden en open opvolging onder Opvolgen', () => {
    expect(bepaalFocusContext('gepost').context).toBe('opvolgen');
    expect(bepaalFocusContext('email_verzonden').context).toBe('opvolgen');
    expect(bepaalFocusContext('opvolging_open').titel).toBe('Opvolgen');
  });

  it('toont afgeronde dossiers als Afgehandeld', () => {
    expect(bepaalFocusContext('afgerond')).toMatchObject({
      context: 'afgehandeld',
      titel: 'Afgehandeld',
    });
  });
});
