import {describe,it,expect} from 'vitest';
import {herkenLinkedInPartijtype} from './linkedinPartijtype';

describe('Voorzichtige LinkedIn-partijclassificatie',()=>{
 it('herkent ondubbelzinnige functies',()=>{
  expect(herkenLinkedInPartijtype('Makelaar in vastgoedbeleggingen','X')).toMatchObject({
   type:'makelaar',partijprofiel:'makelaar',bron:'functie',
  });
  expect(herkenLinkedInPartijtype('Projectontwikkelaar','X')?.type).toBe('ontwikkelaar');
  expect(herkenLinkedInPartijtype('Vastgoedbelegger','X')?.type).toBe('belegger');
 });
 it('herkent expliciete bedrijfsnamen zonder beweerde koopstatus',()=>{
  expect(herkenLinkedInPartijtype('Directeur','VDW Horecamakelaars')?.type).toBe('makelaar');
  expect(herkenLinkedInPartijtype('Founder','BASE Projectontwikkeling')?.type).toBe('ontwikkelaar');
 });
 it('gokt niet op generieke functies of investeringslabels',()=>{
  expect(herkenLinkedInPartijtype('Asset manager','Alpha Investments')).toBeNull();
  expect(herkenLinkedInPartijtype('Directeur','Investments BV')).toBeNull();
  expect(herkenLinkedInPartijtype('Vastgoedadviseur','Vastgoed BV')).toBeNull();
 });
 it('laat hybride rollen en historische handelsnamen ter controle',()=>{
  expect(herkenLinkedInPartijtype('Vastgoedbelegger en projectontwikkelaar','')).toBeNull();
  expect(herkenLinkedInPartijtype('Directeur','NOMOS (voorheen Van Triest Makelaardij)')).toBeNull();
 });
});
