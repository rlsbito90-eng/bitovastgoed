import { describe, expect, it } from 'vitest';
import { bepaalFocusContext, tabVoorFocusContext } from './focusContext';

describe('bepaalFocusContext', () => {
  it('groepeert onderzoeksfasen onder Onderzoeken en routeert naar Kadaster & eigenaar', () => {
    expect(bepaalFocusContext('onderzoek_nodig').context).toBe('onderzoeken');
    expect(bepaalFocusContext('eigenaar_ontbreekt').titel).toBe('Onderzoeken');
    expect(bepaalFocusContext('adres_ontbreekt').titel).toBe('Onderzoeken');
    expect(bepaalFocusContext('onderzoek_nodig').tab).toBe('kadaster');
    expect(tabVoorFocusContext('onderzoeken')).toBe('kadaster');
  });

  it('onderscheidt brief-, print- en postwerk en routeert die naar Brieven & opvolging', () => {
    expect(bepaalFocusContext('brief_voorbereiden').context).toBe('brief_voorbereiden');
    expect(bepaalFocusContext('concept_gereed').context).toBe('te_printen');
    expect(bepaalFocusContext('gereed_voor_print').context).toBe('te_printen');
    expect(bepaalFocusContext('geprint').context).toBe('te_posten');
    expect(bepaalFocusContext('brief_voorbereiden').tab).toBe('brieven');
    expect(bepaalFocusContext('gereed_voor_print').tab).toBe('brieven');
    expect(bepaalFocusContext('geprint').tab).toBe('brieven');
  });

  it('groepeert verzonden en open opvolging onder Opvolgen en routeert naar Brieven', () => {
    expect(bepaalFocusContext('gepost').context).toBe('opvolgen');
    expect(bepaalFocusContext('email_verzonden').context).toBe('opvolgen');
    expect(bepaalFocusContext('opvolging_open').titel).toBe('Opvolgen');
    expect(tabVoorFocusContext('opvolgen')).toBe('brieven');
  });

  it('toont afgeronde dossiers als Afgehandeld', () => {
    expect(bepaalFocusContext('afgerond')).toMatchObject({
      context: 'afgehandeld',
      titel: 'Afgehandeld',
      tab: 'brieven',
    });
  });
});
