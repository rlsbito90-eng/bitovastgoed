import {describe,it,expect} from 'vitest';
import {afstandHemelsbreedKm} from './afstandHemelsbreed';
describe('Haversine — uitsluitend WGS84',()=>{
 it('berekent gelijke punten als 0 km',()=>expect(afstandHemelsbreedKm({lat:52,lon:5},{lat:52,lon:5})).toBe(0));
 it('berekent onafhankelijk van richting',()=>{
   const a={lat:52,lon:5},b={lat:52.1,lon:5.1};
   expect(afstandHemelsbreedKm(a,b)).toBeCloseTo(afstandHemelsbreedKm(b,a)!,10);
 });
 it('weigert ongeldige en onbevestigde coördinaten',()=>{
   expect(afstandHemelsbreedKm({lat:99,lon:5},{lat:52,lon:5})).toBeNull();
   expect(afstandHemelsbreedKm({lat:NaN,lon:5},{lat:52,lon:5})).toBeNull();
 });
});
