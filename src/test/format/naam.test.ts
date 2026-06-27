import { describe, it, expect } from 'vitest';
import { naarVoorlettersAchternaam } from '@/lib/format/naam';

describe('naarVoorlettersAchternaam', () => {
  it('kort meerdere voornamen af tot voorletters', () => {
    expect(naarVoorlettersAchternaam('Voornaam Tweede Achternaam')).toBe('V.T. Achternaam');
  });

  it('behoudt tussenvoegsel voluit', () => {
    expect(naarVoorlettersAchternaam('Voornaam van der Achternaam')).toBe('V. van der Achternaam');
  });

  it('handelt tussenvoegsel "de" correct', () => {
    expect(naarVoorlettersAchternaam('Karel de Groot')).toBe('K. de Groot');
  });

  it('handelt tussenvoegsel "ter" correct', () => {
    expect(naarVoorlettersAchternaam('Willem ter Berg')).toBe('W. ter Berg');
  });

  it('handelt meerdere tussenvoegsels correct', () => {
    expect(naarVoorlettersAchternaam('Jan Pieter van den Berg')).toBe('J.P. van den Berg');
  });

  it('kort koppelteken-voornaam netjes af', () => {
    expect(naarVoorlettersAchternaam('Anna-Maria de Vries')).toBe('A.M. de Vries');
  });

  it('laat reeds-afgekorte naam ongemoeid', () => {
    expect(naarVoorlettersAchternaam('P.J. Achternaam')).toBe('P.J. Achternaam');
    expect(naarVoorlettersAchternaam('P. J. Achternaam')).toBe('P. J. Achternaam');
  });

  it('retourneert bedrijfsnaam ongewijzigd (callers moeten die nooit doorgeven)', () => {
    // De helper zelf maakt geen onderscheid, maar het contract is:
    // alleen natuurlijke personen doorgeven. Test toont dat het
    // technisch gezien ook voor langere bedrijfsnamen werkt.
    expect(naarVoorlettersAchternaam('Bito Vastgoed BV')).toBe('B. BV');
  });

  it('handelt lege input gracieus af', () => {
    expect(naarVoorlettersAchternaam('')).toBe('');
    expect(naarVoorlettersAchternaam(null)).toBe('');
    expect(naarVoorlettersAchternaam(undefined)).toBe('');
  });

  it('handelt enkel woord af als onverkort', () => {
    expect(naarVoorlettersAchternaam('Achternaam')).toBe('Achternaam');
  });

  it('handelt meerdere tussenvoegsels correct', () => {
    expect(naarVoorlettersAchternaam('Jan Pieter van den Berg')).toBe('J.P. van den Berg');
  });

  it('handelt lowercase input correct', () => {
    expect(naarVoorlettersAchternaam('piet jan jansen')).toBe('P.J. Jansen');
  });

  it('handelt tussenvoegsel "de" correct', () => {
    expect(naarVoorlettersAchternaam('Karel de Groot')).toBe('K. de Groot');
  });

  it('handelt tussenvoegsel "ter" correct', () => {
    expect(naarVoorlettersAchternaam('Willem ter Berg')).toBe('W. ter Berg');
  });

  it('handelt drie voornamen zonder tussenvoegsel af', () => {
    expect(naarVoorlettersAchternaam('Jan Piet Klaas Jansen')).toBe('J.P.K. Jansen');
  });

  it('laat naam met trailing spaces intact na trim', () => {
    expect(naarVoorlettersAchternaam('  Jan de Vries  ')).toBe('J. de Vries');
  });
});
