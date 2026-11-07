import { describe, expect, it } from 'vitest';
import { maakObjectVoorstellenVoorRelatie } from './relatieObjectVoorstellenR2';
import type { ObjectVastgoed, Relatie, Zoekprofiel } from '@/data/mock-data';

const relatie: Relatie = {
  id:'r-1',bedrijfsnaam:'Test makelaar',contactpersoon:'',type:'makelaar',
  commercialRoles:['bemiddelaar'],partijprofiel:'bemiddelaar',
  telefoon:'',email:'',regio:['Utrecht'],zoekGemeenten:['De Ronde Venen'],
  assetClasses:[],propertyTypeIds:[],budgetMin:undefined,budgetMax:undefined,
  leadStatus:'actief',ndaGetekend:false,laatsteContact:'',
};
const object = (x: Partial<ObjectVastgoed>={}):ObjectVastgoed=>({
  id:'o-1',titel:'Testpand Mijdrecht',anoniem:true,
  plaats:'Mijdrecht',provincie:'Utrecht',type:'wonen',status:'beschikbaar',
  vraagprijs:450000,exclusief:false,...x,
} as ObjectVastgoed);

describe('Relatie-objecten: dezelfde R2-beoordeling als bij objectkandidaten',()=>{
 it('toont makelaar zonder apart zoekprofiel, maar noemt hem niet automatisch koper',()=>{
  const m=maakObjectVoorstellenVoorRelatie(relatie,[object()],[]);
  expect(m).toHaveLength(1);
  expect(m[0].voorstel.besteRoute.bron).toBe('relatie_basis');
  expect(m[0].voorstel.besteRoute.koperRelatieId).toBeNull();
  expect(m[0].voorstel.besteRoute.toelichting.controleer.join(' ')).toContain('Gemeente van object onbekend');
 });
 it('bewaart aanvullende zoekprofielen als verschillende routes binnen hetzelfde object',()=>{
  const extra={id:'z1',relatieId:relatie.id,naam:'Woningen',status:'actief',
    typeVastgoed:['wonen'],propertyTypeIds:[],regio:['Utrecht'],prijsMax:600000,
    transformatiePotentie:false,ontwikkelPotentie:false,prioriteit:3} as Zoekprofiel;
  const m=maakObjectVoorstellenVoorRelatie(relatie,[object()],[extra]);
  expect(m).toHaveLength(1);
  expect(m[0].voorstel.alleRoutes).toHaveLength(2);
 });
 it('gearchiveerde en verkochte objecten verdwijnen uit nieuwe voorstellen',()=>{
  expect(maakObjectVoorstellenVoorRelatie(relatie,[object({isArchived:true}),object({id:'o2',status:'verkocht'})],[])).toHaveLength(0);
 });
 it('tekort aan objectlocatie geeft geen verzonnen bevestigde gemeente',()=>{
  const m=maakObjectVoorstellenVoorRelatie(relatie,[object({plaats:'Mijdrecht'})],[]);
  expect(m[0].voorstel.besteRoute.kwalificatie).not.toBe('passend');
 });
});
