import {describe,it,expect} from 'vitest';
import { PARTIJPROFIELEN,VASTGOEDSTRATEGIEEN,leesPartijprofiel,leesVastgoedStrategieen,
  schrijfPartijprofiel,schrijfVastgoedStrategieen } from './partijprofiel';

describe('Partijprofiel — onafhankelijk van commerciële rollen',()=>{
 it('bevat ontwikkelende belegger en vastgoedondernemer',()=>{
  expect(PARTIJPROFIELEN.map(x=>x.value)).toContain('ontwikkelende_belegger');
  expect(PARTIJPROFIELEN.map(x=>x.value)).toContain('vastgoedondernemer');
 });
 it('onderscheidt onbekend (null) en onbekende waarden (fout)',()=>{
  expect(leesPartijprofiel(null)).toBeNull();
  expect(leesPartijprofiel(undefined)).toBeNull();
  expect(()=>leesPartijprofiel('investeerder-met-mandaat')).toThrow('Ongeldig');
 });
 it('bewaart een bekend profiel en vult niets automatisch in',()=>{
  expect(schrijfPartijprofiel('ontwikkelende_belegger')).toBe('ontwikkelende_belegger');
  expect(schrijfPartijprofiel(undefined)).toBeUndefined();
 });
 it('ondersteunt meerdere strategieën zonder dubbelen',()=>{
  expect(leesVastgoedStrategieen(['transformatie','transformatie','uitponden']))
    .toEqual(['transformatie','uitponden']);
 });
 it('laat alle strategieën toe en accepteert null',()=>{
  expect(VASTGOEDSTRATEGIEEN).toHaveLength(6);
  expect(schrijfVastgoedStrategieen(null)).toBeNull();
 });
 it('weert onbekende strategieën',()=>{
  expect(()=>leesVastgoedStrategieen(['onbestaand'])).toThrow('Onbekende');
  expect(()=>leesVastgoedStrategieen('transformatie')).toThrow('Ongeldige');
 });
 it('verandert commerciële rollen niet',()=>{
  const relatie={type:'belegger',commercialRoles:['koper'],partijprofiel:'ontwikkelende_belegger',
    vastgoedStrategieen:['transformatie']};
  expect(relatie.type).toBe('belegger');
  expect(relatie.commercialRoles).toEqual(['koper']);
 });
});
