import { describe,it,expect,vi } from 'vitest';
import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import {
  controleerReactie, maakReactieMoment, reactiePipelinePatch,
  formatteerAfwijsredenen, marktsignaalVoorObject, koopsignaalVoorRelatie,
  laatsteGestructureerdeAfwijzing, laatsteReactie, registreerAanbiedingsReactie,
  ReactiePipelineNietBijgewerkt,
  type ReactieInvoer, type AanbiedingReactieDetails,
} from './aanbiedingsReacties';

const reactie=(extra:Partial<ReactieInvoer>={}):ReactieInvoer=>({
  objectId:'o1',relatieId:'r1',objectTitel:'Pand 1',datum:'2026-11-10',
  kanaal:'whatsapp',status:'informatie_gevraagd',redenen:['documentatie'],
  duiding:'onbekend',...extra,
});
const kandidaat=(extra:Partial<PipelineKandidaat>={}):PipelineKandidaat=>({
  id:'k1',objectId:'o1',relatieId:'r1',pipelineFase:'teaser_verstuurd',
  interesseNiveau:'lauw',teaserVerstuurd:true,teaserVerstuurdOp:'2026-11-09',
  ndaVerstuurd:false,ndaGetekend:false,informatieGedeeld:false,
  feeAkkoord:false,...extra,
});
const gebeurtenis=(relatieId:string, status:AanbiedingReactieDetails['status'],
  extra:Partial<ContactMoment>={}):ContactMoment=>({
  id:'cm-'+relatieId,objectId:'o1',relatieId,momentDate:'2026-11-10',
  createdAt:'2026-11-10T11:00:00Z',updatedAt:'2026-11-10T11:00:00Z',
  direction:status==='geen_reactie'?'intern':'inkomend',type:'whatsapp',
  title:'Reactie',isSystem:false,followUpRequired:false,
  aanbiedingReactie:{versie:'1',status,redenen:['prijs'],duiding:'object',kanaal:'whatsapp'},
  ...extra,
});
const deps=(extra:Record<string,unknown>={})=>({
  bestaandeKandidaat:kandidaat(),
  bestaandeMomenten:[] as ContactMoment[],
  maakKandidaat:vi.fn(async (_k:Omit<PipelineKandidaat,'id'|'createdAt'|'updatedAt'>)=>kandidaat()),
  voegMomentToe:vi.fn(async (_m:Omit<ContactMoment,'id'|'createdAt'|'updatedAt'|'isSystem'>)=>gebeurtenis('r1','informatie_gevraagd')),
  werkKandidaatBij:vi.fn(async (_id:string,_patch:Partial<PipelineKandidaat>)=>undefined),
  ...extra,
});

describe('Matching 3: reacties op daadwerkelijke aanbiedingen',()=>{
  it('aanvullende informatie vragen maakt geen koopinteresse of afwijzing',()=>{
    const patch=reactiePipelinePatch(kandidaat(),reactie());
    expect(patch.pipelineFase).toBeUndefined();
    expect(patch.interesseNiveau).toBeUndefined();
    expect(patch.volgendeActie).toBe('stukken_delen');
  });
  it('uitgesproken interesse mag een vroege kandidaat promoten, geen gevorderde onderhandeling terugzetten',()=>{
    const keuze=reactie({status:'interesse',redenen:[]});
    expect(reactiePipelinePatch(kandidaat(),keuze)).toMatchObject({
      pipelineFase:'interesse_ontvangen',interesseNiveau:'warm',
    });
    const later=reactiePipelinePatch(kandidaat({
      pipelineFase:'onderhandeling',interesseNiveau:'zeer_warm',
    }),keuze);
    expect(later.pipelineFase).toBeUndefined();
    expect(later.interesseNiveau).toBeUndefined();
  });
  it('expliciete afwijzing houdt afwijsreden en behoudt historische bodfasen',()=>{
    const nee=reactie({status:'afgewezen',redenen:['rendement','prijs']});
    const eerste=reactiePipelinePatch(kandidaat(),nee);
    expect(eerste.pipelineFase).toBe('afgevallen');
    expect(eerste.redenAfgevallen).toContain('Rendement');
    expect(reactiePipelinePatch(kandidaat({
      pipelineFase:'onderhandeling',redenAfgevallen:'Anders',laatsteContactdatum:'2026-11-11',
    }),nee)).toEqual({});
  });
  it('stilte is interne notitie, nooit afwijzing of contact',()=>{
    const input=reactie({status:'geen_reactie',redenen:[]});
    const evt=maakReactieMoment(input);
    expect(evt.direction).toBe('intern');
    expect(evt.type).toBe('notitie');
    expect(reactiePipelinePatch(kandidaat(),input)).toEqual({});
  });
  it('meer redenen en duiding worden gestructureerd opgeslagen',()=>{
    const evt=maakReactieMoment(reactie({
      status:'afgewezen',redenen:['prijs','rendement'],duiding:'object',
      notitie:'Prijs is niet haalbaar',
    }));
    expect(evt.aanbiedingReactie).toMatchObject({
      status:'afgewezen',redenen:['prijs','rendement'],duiding:'object',versie:'1',
    });
    expect(evt.description).toContain('Prijs is niet haalbaar');
    expect(evt.relatieId).toBe('r1');
    expect(evt.objectId).toBe('o1');
  });
  it('validatie weigert ongeldige of toekomstige datum en dubbele reden',()=>{
    expect(controleerReactie(reactie({datum:'2030-01-01'}),'2026-11-11')).toMatch(/datum/);
    expect(controleerReactie(reactie({redenen:['prijs','prijs']}),'2026-11-11')).toMatch(/verschillende/);
    expect(controleerReactie(reactie({datum:'2026-11-10'}),'2026-11-11')).toBeNull();
  });
  it('zonder reactie mogen geen oorzaak of afwijzingsredenen worden geregistreerd',()=>{
    const input=reactie({
      status:'geen_reactie',redenen:['prijs'],duiding:'object',
    });
    expect(controleerReactie(input,'2026-11-11')).toMatch(/geen reden of oorzaak/);
  });
  it('een expliciete afwijzing vereist een redencategorie',()=>{
    expect(controleerReactie(
      reactie({status:'afgewezen',redenen:[]}),
      '2026-11-11',
    )).toMatch(/minimaal één redencategorie/);
  });
  it('andere reden vereist een korte toelichting en blijft als code Anders opgeslagen',()=>{
    const input=reactie({
      status:'afgewezen',redenen:['rendement','anders'],duiding:'koper',
      andereReden:'Vereist eigen exploitatiebedrijf',
    });
    expect(controleerReactie(input,'2026-11-11')).toBeNull();
    const event=maakReactieMoment(input);
    expect(event.aanbiedingReactie).toMatchObject({
      redenen:['rendement','anders'],
      andereReden:'Vereist eigen exploitatiebedrijf',
    });
    expect(event.description).toContain('Andere reden: Vereist eigen exploitatiebedrijf');
    expect(formatteerAfwijsredenen(event.aanbiedingReactie!))
      .toContain('Rendement, Andere reden: Vereist eigen exploitatiebedrijf');
    expect(controleerReactie({
      ...input,andereReden:'  ',
    },'2026-11-11')).toMatch(/Beschrijf de andere reden/);
    expect(controleerReactie({
      ...input,andereReden:'x'.repeat(501),
    },'2026-11-11')).toMatch(/maximaal 500/);
    expect(controleerReactie({
      ...input,redenen:['prijs'],
    },'2026-11-11')).toMatch(/Selecteer Anders/);
  });
  it('gestructureerde afwijzing blijft leidend; losse oude notitie wordt niet meegeteld',()=>{
    const events=[
      gebeurtenis('r1','informatie_gevraagd',{momentDate:'2026-11-11'}),
      gebeurtenis('r1','afgewezen',{momentDate:'2026-11-10'}),
    ];
    expect(laatsteGestructureerdeAfwijzing('r1','o1',events)?.aanbiedingReactie?.status)
      .toBe('afgewezen');
    expect(laatsteGestructureerdeAfwijzing('r2','o1',events)).toBeUndefined();
  });
  it('drie verschillende vrije Anders-redenen zijn geen inhoudelijk patroon',()=>{
    const events=['r1','r2','r3'].map((relatieId,i)=>gebeurtenis(
      relatieId,'afgewezen',{
        aanbiedingReactie:{
          versie:'1',status:'afgewezen',redenen:['anders'],
          andereReden:'Niet standaard reden nummer '+i,
          duiding:'onbekend',kanaal:'whatsapp',
        },
      },
    ));
    const object=marktsignaalVoorObject('o1',events);
    expect(object.andersAantal).toBe(3);
    expect(object.patronen).toEqual([]);
    const investeerder=koopsignaalVoorRelatie('r1',[
      ...['o1','o2','o3'].map((objectId,i)=>gebeurtenis('r1','afgewezen',{
        objectId,id:'anders-'+i,
        aanbiedingReactie:{
          versie:'1',status:'afgewezen',redenen:['anders'],
          andereReden:'Uitzondering '+i,duiding:'koper',kanaal:'whatsapp',
        },
      })),
    ]);
    expect(investeerder.andersAantal).toBe(3);
    expect(investeerder.patronen).toEqual([]);
  });
  it('geen reactie vereist een al eerder aangeboden object, niet alleen een potentiële match',async()=>{
    const d=deps({bestaandeKandidaat:kandidaat({
      pipelineFase:'match_gevonden',teaserVerstuurd:false,teaserVerstuurdOp:undefined,
      informatieGedeeld:false,
    })});
    await expect(registreerAanbiedingsReactie(
      reactie({status:'geen_reactie',redenen:[]}),d,'2026-11-11',
    )).rejects.toThrow(/oorspronkelijke aanbieding/);
    expect(d.voegMomentToe).not.toHaveBeenCalled();
  });
  it('laatste reactie wordt op datum per relatie en object geselecteerd',()=>{
    const events=[
      gebeurtenis('r1','interesse',{momentDate:'2026-11-07'}),
      gebeurtenis('r2','afgewezen',{momentDate:'2026-11-10'}),
      gebeurtenis('r1','informatie_gevraagd',{momentDate:'2026-11-11'}),
      gebeurtenis('r1','afgewezen',{objectId:'o2',momentDate:'2026-11-12'}),
    ];
    expect(laatsteReactie('r1','o1',events)?.aanbiedingReactie?.status).toBe('informatie_gevraagd');
  });
  it('vier afzonderlijke prijsafwijzingen van vijf reacties geven marktsignaal',()=>{
    const events=[
      ...['r1','r2','r3','r4'].map(id=>gebeurtenis(id,'afgewezen')),
      gebeurtenis('r5','interesse',{aanbiedingReactie:{
        versie:'1',status:'interesse',redenen:[],duiding:'onbekend',kanaal:'email',
      }}),
      gebeurtenis('r1','afgewezen',{momentDate:'2026-11-08'}), // extra event is geen nieuwe koper
      gebeurtenis('r6','geen_reactie'),
    ];
    const x=marktsignaalVoorObject('o1',events);
    expect(x.reacties).toBe(5);
    expect(x.afwijzingen).toBe(4);
    expect(x.zonderReactie).toBe(1);
    expect(x.patronen[0]).toMatchObject({reden:'prijs',aantal:4,reacties:5});
  });
  it('drie verschillende afgewezen objecten geven profielreviewvoorstel, geen profielwijziging',()=>{
    const events=['o1','o2','o3'].map(objectId=>
      gebeurtenis('r1','afgewezen',{objectId,id:'cm-'+objectId}));
    const resultaat=koopsignaalVoorRelatie('r1',events);
    expect(resultaat.reacties).toBe(3);
    expect(resultaat.patronen).toEqual(expect.arrayContaining([
      expect.objectContaining({reden:'prijs',aantal:3}),
    ]));
    const extra=koopsignaalVoorRelatie('r1',[
      ...events,gebeurtenis('r1','afgewezen',{
        objectId:'o2',momentDate:'2026-11-11',id:'later',
      }),
    ]);
    expect(extra.patronen[0].aantal).toBe(3);
    expect(koopsignaalVoorRelatie('r2',events).patronen).toEqual([]);
  });
  it('geen marktconclusie na een enkele afwijzing en geen afwijzing uit stilte',()=>{
    const x=marktsignaalVoorObject('o1',[gebeurtenis('r1','afgewezen'),gebeurtenis('r2','geen_reactie')]);
    expect(x.patronen).toEqual([]);
    expect(x.reacties).toBe(1);
    expect(x.afwijzingen).toBe(1);
  });
  it('legt reactie bij bestaande kandidaat vast in één tijdlijngebeurtenis',async()=>{
    const d=deps();
    await registreerAanbiedingsReactie(reactie(),d,'2026-11-11');
    expect(d.maakKandidaat).not.toHaveBeenCalled();
    expect(d.voegMomentToe).toHaveBeenCalledTimes(1);
    expect(d.werkKandidaatBij).toHaveBeenCalledWith('k1',expect.objectContaining({
      volgendeActie:'stukken_delen',
    }));
  });
  it('kan ontbrekende kandidaat koppelen, zonder hem als aangeboden te markeren',async()=>{
    const d=deps({bestaandeKandidaat:undefined});
    await registreerAanbiedingsReactie(reactie({status:'interesse',redenen:[]}),d,'2026-11-11');
    expect(d.maakKandidaat).toHaveBeenCalledTimes(1);
    const created=d.maakKandidaat.mock.calls[0][0] as PipelineKandidaat;
    expect(created.teaserVerstuurd).toBe(false);
    expect(created.informatieGedeeld).toBe(false);
  });
  it('gedeeltelijke fout is expliciet en behoudt tijdlijngebeurtenis',async()=>{
    const d=deps({werkKandidaatBij:vi.fn().mockRejectedValue(new Error('db down'))});
    await expect(registreerAanbiedingsReactie(reactie(),d,'2026-11-11'))
      .rejects.toBeInstanceOf(ReactiePipelineNietBijgewerkt);
    expect(d.voegMomentToe).toHaveBeenCalledTimes(1);
  });
});
