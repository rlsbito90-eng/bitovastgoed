import {describe,it,expect} from 'vitest';
import { COMMERCIELE_ROLLEN, leesCommercieleRollen, schrijfCommercieleRollen } from './commercieleRollen';

describe('Commerciële rollen zonder destructieve backfill',()=>{
 it('heeft 9 vaste rollen, waaronder makelaar en bemiddelaar',()=>{
  expect(COMMERCIELE_ROLLEN).toHaveLength(9);
  expect(COMMERCIELE_ROLLEN.map(x=>x.value)).toContain('makelaar');
 });
 it('onderscheidt onbekend, expliciet leeg en weggelaten',()=>{
  expect(leesCommercieleRollen(undefined)).toBeNull();
  expect(leesCommercieleRollen(null)).toBeNull();
  expect(leesCommercieleRollen([])).toEqual([]);
  expect(schrijfCommercieleRollen(undefined)).toBeUndefined();
  expect(schrijfCommercieleRollen(null)).toBeNull();
 });
 it('laat koper, verkoper en bemiddelaar tegelijk toe',()=>{
  expect(schrijfCommercieleRollen(['koper','verkoper','bemiddelaar'])).toEqual(['koper','verkoper','bemiddelaar']);
 });
 it('ontdubbelt zonder gekozen rollen te verliezen',()=>{
  expect(leesCommercieleRollen(['koper','koper','makelaar'])).toEqual(['koper','makelaar']);
 });
 it('weigert onbekende rollen in plaats van ze stilzwijgend te verliezen',()=>{
  expect(()=>schrijfCommercieleRollen(['onbestaand' as any])).toThrow('Onbekende');
 });
});
