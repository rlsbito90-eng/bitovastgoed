import { describe, it, expect } from 'vitest';
import { naarVoorlettersAchternaam, isRechtspersoonNaam } from '@/lib/format/naam';


describe('naarVoorlettersAchternaam', () => {
  it('kort meerdere voornamen af tot voorletters', () => {
    expect(naarVoorlettersAchternaam('Voornaam Tweede Achternaam')).toBe('V.T. Achternaam');
  });

  it('behoudt tussenvoegsel voluit', () => {
    expect(naarVoorlettersAchternaam('Voornaam van der Achternaam')).toBe('V. van der Achternaam');
  });

  it('kort koppelteken-voornaam netjes af', () => {
    expect(naarVoorlettersAchternaam('Anna-Maria de Vries')).toBe('A.M. de Vries');
  });

  it('laat reeds-afgekorte naam ongemoeid', () => {
    expect(naarVoorlettersAchternaam('P.J. Achternaam')).toBe('P.J. Achternaam');
    expect(naarVoorlettersAchternaam('P. J. Achternaam')).toBe('P. J. Achternaam');
  });

  it('laat rechtspersoon ongemoeid (BV met punten)', () => {
    expect(naarVoorlettersAchternaam('Voorbeeld Vastgoed B.V.')).toBe('Voorbeeld Vastgoed B.V.');
  });

  it('laat rechtspersoon ongemoeid (BV zonder punten)', () => {
    expect(naarVoorlettersAchternaam('Voorbeeld Holding BV')).toBe('Voorbeeld Holding BV');
  });

  it('laat stichting ongemoeid', () => {
    expect(naarVoorlettersAchternaam('Stichting Voorbeeld')).toBe('Stichting Voorbeeld');
  });

  it('laat naam met & ongemoeid', () => {
    expect(naarVoorlettersAchternaam('Voorbeeld & Partner B.V.')).toBe('Voorbeeld & Partner B.V.');
    expect(naarVoorlettersAchternaam('Jansen & Co')).toBe('Jansen & Co');
  });

  it('isRechtspersoonNaam herkent gangbare rechtsvormen', () => {
    expect(isRechtspersoonNaam('Voorbeeld B.V.')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld BV')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld N.V.')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld NV')).toBe(true);
    expect(isRechtspersoonNaam('Stichting Voorbeeld')).toBe(true);
    expect(isRechtspersoonNaam('Vereniging Voorbeeld')).toBe(true);
    expect(isRechtspersoonNaam('Coöperatie Voorbeeld')).toBe(true);
    expect(isRechtspersoonNaam('Cooperatie Voorbeeld')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld V.O.F.')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld VOF')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld C.V.')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld CV')).toBe(true);
    expect(isRechtspersoonNaam('Maatschap Voorbeeld')).toBe(true);
    expect(isRechtspersoonNaam('Voorbeeld & Partner')).toBe(true);
    expect(isRechtspersoonNaam('voorbeeld holding bv')).toBe(true);
    expect(isRechtspersoonNaam('Jan de Vries')).toBe(false);
    expect(isRechtspersoonNaam('')).toBe(false);
    expect(isRechtspersoonNaam(null)).toBe(false);
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
