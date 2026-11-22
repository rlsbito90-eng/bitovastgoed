import { describe, expect, it } from 'vitest';
import { maakKandidaatVoorstellen, type CrmObjectInput, type CrmRelatieInput } from './rolMandaatAdapter';
import { isObjectAanbiederRelatie } from './objectAanbiederUitsluiting';
import { maakObjectVoorstellenVoorRelatie } from './relatieObjectVoorstellenR2';
import type { ObjectVastgoed, Relatie } from '@/data/mock-data';

const object = (overrides:Partial<CrmObjectInput>={}):CrmObjectInput=>({
  id:'sweelinck', status:'beschikbaar',type:'commercieel',
  propertyTypeId:'type-wonen',vraagprijs:1750000,plaats:'Den Haag',
  provincie:'Zuid-Holland', eigenaarRelatieId:'frisia',
  verkoperNaam:'Jorg Ollie',...overrides,
});
const relatie = (overrides:Partial<CrmRelatieInput>={}):CrmRelatieInput=>({
  id:'koper',type:'belegger',propertyTypeIds:['type-wonen'],
  budgetMax:2500000,regio:['Zuid-Holland'],...overrides,
});

describe('Aanbieders, verkopers en objectcontacten horen niet in de kopersmatching voor hun eigen object',()=>{
  it('specifieke CRM-casus: gekoppeld makelaarskantoor met Jorg Ollie als contact valt af',()=>{
    const aanbieder=relatie({
      id:'frisia',type:'makelaar',bedrijfsnaam:'Frisia makelaars',
      contactpersoonNamen:['Jorg Ollie'],
    });
    expect(isObjectAanbiederRelatie(object(),aanbieder)).toBe(true);
    expect(maakKandidaatVoorstellen(object(),[aanbieder],[],{toonAfwijkende:true})).toHaveLength(0);
  });

  it('een beleggingsprofiel of actief mandaat heft de objectgebonden aanbiederuitsluiting niet op',()=>{
    const aanbieder=relatie({id:'frisia',commercialRoles:['koper'],bedrijfsnaam:'Frisia makelaars'});
    const p={id:'mandaat',relatieId:'frisia',status:'actief',propertyTypeIds:['type-wonen'],prijsMax:3000000};
    expect(maakKandidaatVoorstellen(object(),[aanbieder],[p],{toonAfwijkende:true})).toHaveLength(0);
  });

  it('hetzelfde kantoor kan bij een ander object wél een relevante aankoopcontactpersoon zijn',()=>{
    const aanbieder=relatie({id:'frisia',bedrijfsnaam:'Frisia makelaars',contactpersoonNamen:['Jorg Ollie']});
    const ander=object({id:'ander',eigenaarRelatieId:'andere-verkoper',verkoperNaam:'Andere eigenaar'});
    expect(isObjectAanbiederRelatie(ander,aanbieder)).toBe(false);
    expect(maakKandidaatVoorstellen(ander,[aanbieder],[])).toHaveLength(1);
  });

  it('historische naam van verkoper of contactpersoon herkent exact dezelfde contactpersoon bij een relatie',()=>{
    const onbekend=object({eigenaarRelatieId:null});
    const contact=relatie({id:'aanbieder',bedrijfsnaam:'Makelaardij Zuid',contactpersoonNamen:['Jorg Ollie']});
    expect(isObjectAanbiederRelatie(onbekend,contact)).toBe(true);
    expect(maakKandidaatVoorstellen(onbekend,[contact],[])).toHaveLength(0);
    const viaContact=object({eigenaarRelatieId:null,verkoperNaam:null,contactNaam:'Jorg Ollie'});
    expect(isObjectAanbiederRelatie(viaContact,contact)).toBe(true);
  });

  it('geregistreerde verkoper-e-mail matcht exact met relatie of contactpersonen',()=>{
    const o=object({eigenaarRelatieId:null,verkoperNaam:null,verkoperEmail:' makelaar@voorbeeld.nl '});
    expect(isObjectAanbiederRelatie(o,relatie({email:'MAKELAAR@voorbeeld.nl'}))).toBe(true);
    expect(isObjectAanbiederRelatie(o,relatie({contactEmails:['makelaar@voorbeeld.nl']}))).toBe(true);
    expect(isObjectAanbiederRelatie(o,relatie({email:'anders@voorbeeld.nl'}))).toBe(false);
  });

  it('geen gedeeltelijke of vage naammatches die legitieme kopers wegfilteren',()=>{
    const o=object({eigenaarRelatieId:null,verkoperNaam:'Jorg Ollie'});
    expect(isObjectAanbiederRelatie(o,relatie({contactpersoonNamen:['Jorgen Ollie']}))).toBe(false);
    expect(isObjectAanbiederRelatie(o,relatie({bedrijfsnaam:'Jorg Ollie Vastgoed'}))).toBe(false);
    expect(isObjectAanbiederRelatie(o,relatie({contactpersoonNamen:['Jorg']}))).toBe(false);
    expect(isObjectAanbiederRelatie(o,relatie({bedrijfsnaam:'Jorg Ollie'}))).toBe(true);
  });

  it('dezelfde uitsluiting geldt vanuit het relatiedossier: geen eigen aanbod als aankoopvoorstel',()=>{
    const o = {
      ...object(),titel:'1e Sweelinckstraat 26',isPortefeuille:false,anoniem:false,
      exclusief:false,verhuurStatus:'verhuurd',ontwikkelPotentie:false,
      transformatiePotentie:false,documentenBeschikbaar:false,plaats:'Den Haag',
      provincie:'Zuid-Holland',
    } as unknown as ObjectVastgoed;
    const r = {...relatie({id:'frisia',bedrijfsnaam:'Frisia makelaars'}),bedrijfsnaam:'Frisia makelaars'} as unknown as Relatie;
    expect(maakObjectVoorstellenVoorRelatie(r,[o],[])).toHaveLength(0);
    const ander = {...o,id:'andere-propositie',eigenaarRelatieId:'andere-partij',verkoperNaam:'Andere partij'};
    expect(maakObjectVoorstellenVoorRelatie(r,[ander],[])).toHaveLength(1);
  });

  it('match berekening blijft read-only en raakt historische pipeline/afwijzingen niet',()=>{
    const o=Object.freeze(object());
    const r=Object.freeze(relatie({id:'frisia'}));
    const original=JSON.stringify([o,r]);
    expect(maakKandidaatVoorstellen(o,[r],[])).toHaveLength(0);
    expect(JSON.stringify([o,r])).toBe(original);
  });
});
