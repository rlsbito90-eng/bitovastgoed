import {describe,it,expect} from 'vitest';
import {berekenRelatiePagina} from './relatiePaginering';

describe('Relaties paginering',()=>{
 it('toont standaard 25 relaties met correcte aantallen',()=>{
  const p=berekenRelatiePagina(736,1);
  expect(p).toMatchObject({pagina:1,aantal:30,startIndex:0,eindeIndex:25,beginNummer:1});
  expect(p.nummers).toEqual([1,2,3,4,5]);
 });
 it('toont de laatste korte pagina zonder verlies',()=>{
  expect(berekenRelatiePagina(736,30)).toMatchObject({
   pagina:30,aantal:30,startIndex:725,eindeIndex:736,beginNummer:726,
  });
 });
 it('klemt een onthouden pagina na filtering terug naar geldige grenzen',()=>{
  expect(berekenRelatiePagina(9,26)).toMatchObject({pagina:1,aantal:1,beginNummer:1,eindeIndex:9});
 });
 it('behandelt lege lijsten veilig',()=>{
  expect(berekenRelatiePagina(0,50)).toMatchObject({pagina:1,aantal:1,beginNummer:0,eindeIndex:0});
 });
 it('beperkt paginaknoppen tot vijf rondom de huidige pagina',()=>{
  expect(berekenRelatiePagina(736,16).nummers).toEqual([14,15,16,17,18]);
  expect(berekenRelatiePagina(736,30).nummers).toEqual([26,27,28,29,30]);
 });
});
