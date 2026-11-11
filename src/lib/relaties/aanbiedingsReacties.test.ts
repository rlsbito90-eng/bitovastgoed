import { describe,it,expect,vi } from 'vitest';
import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import {
  controleerReactie, maakReactieMoment, reactiePipelinePatch,
  marktsignaalVoorObject, laatsteReactie, registreerAanbiedingsReactie,
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
