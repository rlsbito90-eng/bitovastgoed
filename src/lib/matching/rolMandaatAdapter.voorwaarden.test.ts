import { describe, expect, it } from 'vitest';
import {
  maakKandidaatVoorstellen, type CrmMandaatInput, type CrmObjectInput,
  type CrmRelatieInput,
} from './rolMandaatAdapter';
import { bepaalInhoudelijkeVoorstelPrioriteit } from './voorstelPrioriteit';

const object: CrmObjectInput = {
  id:'object-1',status:'beschikbaar',type:'wonen',propertyTypeId:'woning',
  provincie:'Noord-Brabant',plaats:'Breda',vraagprijs:650000,
};
const relatie: CrmRelatieInput = {
  id:'koper-1',type:'belegger',propertyTypeIds:['woning'],
  regio:['Noord-Brabant'],budgetMax:750000,
};
const matches=(r:CrmRelatieInput,p:CrmMandaatInput[]=[]) =>
  maakKandidaatVoorstellen(object,[r],p,{toonAfwijkende:true});

describe('Nieuwe matching: vrije aankoopvoorwaarden zijn nooit onterecht groen', () => {
  it('markeert letterlijke uitsluitingen als controle, zonder ze als automatisch knock-out te gebruiken', () => {
    const m=matches({...relatie,uitsluitingen:'Geen objecten zonder bedrijfsruimte'});
    expect(m).toHaveLength(1);
    expect(m[0].besteRoute.kwalificatie).toBe('te_verifieren');
    expect(m[0].besteRoute.toelichting.controleer).toContain(
      'Expliciete uitsluitingen van de relatie handmatig toetsen',
    );
    expect(bepaalInhoudelijkeVoorstelPrioriteit(m[0].besteRoute,object)).toBe('controleren');
    expect(m[0].besteRoute.toelichting.afwijkend).toHaveLength(0);
  });

  it('zonder aanvullende vrije voorwaarden blijft aantoonbare match dezelfde', () => {
    const m=matches(relatie);
    expect(m[0].besteRoute.kwalificatie).toBe('passend');
    expect(bepaalInhoudelijkeVoorstelPrioriteit(m[0].besteRoute,object)).toBe('kansrijk');
  });

  it('vraagt toetsing van rendement en strategische randvoorwaarden bij algemene kooproute', () => {
    const m=matches({...relatie,
      aankoopcriteria:'Alleen minimaal 70% bedrijfsruimte',
      rendementsdoelToelichting:'NAR 8,5%',
      gewensteSituatie:['verhuurd'],
      strategieToelichting:'Waarde toevoegen door transformatie',
    });
    const check=m[0].besteRoute.toelichting.controleer.join(' ');
    expect(check).toContain('Aanvullende aankoopcriteria');
    expect(check).toContain('rendementsdoel');
    expect(check).toContain('investeringsstrategie');
    expect(m[0].besteRoute.kwalificatie).toBe('te_verifieren');
  });

  it('verwerkt een apart zoekprofiel zonder dat algemene vrijetekstcriteria hard worden overgenomen', () => {
    const p:CrmMandaatInput={
      id:'profiel-1',relatieId:'koper-1',status:'actief',
      propertyTypeIds:['woning'],regio:['Noord-Brabant'],
      prijsMax:800000,aanvullendeCriteria:'Alleen waardetoevoeging mogelijk',
    };
    const m=matches({...relatie,aankoopcriteria:'Algemene opmerking'},[p]);
    const profiel=m[0].alleRoutes.find(r=>r.zoekprofielId==='profiel-1');
    expect(profiel?.kwalificatie).toBe('te_verifieren');
    expect(profiel?.toelichting.controleer.join(' ')).toContain('Aanvullende voorwaarden van dit zoekprofiel');
    expect(profiel?.toelichting.controleer.join(' ')).not.toContain('Aanvullende aankoopcriteria van de relatie');
    expect(m[0].alleRoutes).toHaveLength(2);
  });

  it('globale uitgesloten situatie blijft ter controle zichtbaar bij een afzonderlijke zoekroute', () => {
    const p:CrmMandaatInput={
      id:'profiel-1',relatieId:'koper-1',status:'actief',
      propertyTypeIds:['woning'],regio:['Noord-Brabant'],prijsMax:800000,
    };
    const m=matches({...relatie,uitsluitingen:'Geen leegstaande gebouwen'},[p]);
    expect(m[0].alleRoutes).toHaveLength(2);
    for(const route of m[0].alleRoutes){
      expect(route.toelichting.controleer).toContain(
        'Expliciete uitsluitingen van de relatie handmatig toetsen',
      );
      expect(route.kwalificatie).toBe('te_verifieren');
    }
  });

  it('harde voorwaarden zijn een verplichte controle en nooit automatisch een afwijzing op vrijetekst',()=>{
    const m=matches({...relatie,hardeAankoopvoorwaarden:'Minimaal 70% bedrijfsruimte'});
    expect(m).toHaveLength(1);
    expect(m[0].besteRoute.kwalificatie).toBe('te_verifieren');
    expect(m[0].besteRoute.toelichting.controleer.join(' ')).toContain('Harde aankoopvoorwaarden');
    expect(m[0].besteRoute.toelichting.afwijkend).toHaveLength(0);
  });

  it('voorkeuren mogen geen harde uitsluiting of negatief matchoordeel veroorzaken',()=>{
    const m=matches({...relatie,aankoopvoorkeuren:'Bij voorkeur verhuurd'});
    expect(m).toHaveLength(1);
    expect(m[0].besteRoute.kwalificatie).toBe('passend');
    expect(m[0].besteRoute.toelichting.controleer.join(' ')).toContain('Niet-bindende aankoopvoorkeuren');
    expect(m[0].besteRoute.toelichting.afwijkend).toHaveLength(0);
  });

  it('relatiebrede harde voorwaarden blijven zichtbaar bij een afzonderlijk zoekprofiel',()=>{
    const p:CrmMandaatInput={
      id:'profiel-1',relatieId:'koper-1',status:'actief',
      propertyTypeIds:['woning'],regio:['Noord-Brabant'],prijsMax:800000,
    };
    const m=matches({...relatie,hardeAankoopvoorwaarden:'NAR minimaal 8,5%'},[p]);
    expect(m[0].alleRoutes).toHaveLength(2);
    for(const route of m[0].alleRoutes){
      expect(route.kwalificatie).toBe('te_verifieren');
      expect(route.toelichting.controleer.join(' ')).toContain('Harde aankoopvoorwaarden');
    }
  });

  it('geeft letterlijke harde voorwaarden, uitsluitingen en voorkeuren door in beide zoekroutes', () => {
    const p:CrmMandaatInput = {id:'p',relatieId:'koper-1',status:'actief',
      propertyTypeIds:['woning'],aanvullendeCriteria:'Positieve bezichtiging'};
    const m=matches({...relatie,hardeAankoopvoorwaarden:'  Minimaal 70% bedrijfsruimte  ',
      uitsluitingen:'Geen erfpacht', aankoopvoorkeuren:'Bij voorkeur verhuurd',
      aankoopcriteria:'Algemeen criterium'},[p]);
    const basis=m[0].alleRoutes.find(r=>r.bron==='relatie_basis');
    const profiel=m[0].alleRoutes.find(r=>r.zoekprofielId==='p');
    for(const route of [basis,profiel]){
      expect(route?.toelichting.voorwaarden).toEqual(expect.arrayContaining([
        {soort:'hard',tekst:'Minimaal 70% bedrijfsruimte'},
        {soort:'uitsluiting',tekst:'Geen erfpacht'},
        {soort:'voorkeur',tekst:'Bij voorkeur verhuurd'},
      ]));
      expect(route?.kwalificatie).toBe('te_verifieren');
      expect(route?.toelichting.afwijkend).toHaveLength(0);
    }
    expect(basis?.toelichting.voorwaarden).toContainEqual({soort:'aanvullend',tekst:'Algemeen criterium'});
    expect(profiel?.toelichting.voorwaarden).not.toContainEqual({soort:'aanvullend',tekst:'Algemeen criterium'});
    expect(profiel?.toelichting.voorwaarden).toContainEqual({soort:'profiel',tekst:'Positieve bezichtiging'});
  });

  it('maakt geen voorwaarden aan uit lege tekst en verandert voorkeuren niet in harde criteria', () => {
    expect(matches({...relatie,hardeAankoopvoorwaarden:'   '})[0].besteRoute.toelichting.voorwaarden).toBeUndefined();
    const route=matches({...relatie,aankoopvoorkeuren:'Bij voorkeur verhuurd'})[0].besteRoute;
    expect(route.toelichting.voorwaarden).toEqual([{soort:'voorkeur',tekst:'Bij voorkeur verhuurd'}]);
    expect(route.kwalificatie).toBe('passend');
  });

  it('bestaande koopuitwisselingsveiligheid blijft behouden', () => {
    const m=matches(relatie);
    expect(m[0].kanAutomatischVersturen).toBe(false);
    expect(m[0].kanAutomatischBodMaken).toBe(false);
  });
});
