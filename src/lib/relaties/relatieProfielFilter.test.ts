import {describe,it,expect} from 'vitest';
import type {Relatie} from '@/data/mock-data';
import {
  normaalProfielFilter, matchRelatieProfiel, relatieProfielLabel,
} from './relatieProfielFilter';

const oud={type:'belegger',partijprofiel:null} as Relatie;
const fonds={type:'belegger',partijprofiel:'fonds'} as Relatie;
const ontwikkelende={type:'belegger',partijprofiel:'ontwikkelende_belegger'} as Relatie;

describe('Partijprofiel — lijst en oude filters',()=>{
 it('vervangt de historische belegger-default nooit door een bewezen profiel',()=>{
   expect(relatieProfielLabel(oud)).toBe('Nog niet geclassificeerd');
   expect(matchRelatieProfiel(oud,'profiel:belegger')).toBe(false);
   expect(matchRelatieProfiel(oud,'zonder_profiel')).toBe(true);
 });
 it('filtert ontwikkelende belegger en fonds op expliciet partijprofiel',()=>{
   expect(relatieProfielLabel(fonds)).toBe('Fonds');
   expect(matchRelatieProfiel(fonds,'profiel:fonds')).toBe(true);
   expect(matchRelatieProfiel(fonds,'profiel:belegger')).toBe(false);
   expect(matchRelatieProfiel(ontwikkelende,'profiel:ontwikkelende_belegger')).toBe(true);
 });
 it('laat historische filter expliciet bestaan zodat eerdere sessieselecties werken',()=>{
   expect(matchRelatieProfiel(oud,'legacy:belegger')).toBe(true);
   expect(matchRelatieProfiel(fonds,'legacy:belegger')).toBe(true);
 });
 it('weigert onbekende en vervuilde waarden',()=>{
   expect(normaalProfielFilter('profiel:niet_bestaand')).toBe('');
   expect(normaalProfielFilter('legacy:kwijt')).toBe('');
   expect(normaalProfielFilter('profiel:ontwikkelende_belegger')).toBe('profiel:ontwikkelende_belegger');
 });
});
