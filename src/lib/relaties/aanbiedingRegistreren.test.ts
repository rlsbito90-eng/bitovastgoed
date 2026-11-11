import { describe,it,expect,vi } from 'vitest';
import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import {
  registreerAanbieding,kandidaatAanbiedingPatch,heeftZelfdeAanbieding,
  controleerAanbieding,GedeeltelijkeAanbiedingRegistratie,
  maakAanbiedingsMoment,type AanbiedingInvoer,
} from './aanbiedingRegistreren';

const input=(extra:Partial<AanbiedingInvoer>={}):AanbiedingInvoer=>({
  objectId:'object-1',relatieId:'relatie-1',
  objectTitel:'Verhuurd bedrijfspand',soort:'teaser',
  kanaal:'whatsapp',datum:'2026-11-10',...extra,
});
const kandidaat=(extra:Partial<PipelineKandidaat>={}):PipelineKandidaat=>({
  id:'k1',objectId:'object-1',relatieId:'relatie-1',
  pipelineFase:'match_gevonden',interesseNiveau:'lauw',
  teaserVerstuurd:false,ndaVerstuurd:false,ndaGetekend:false,
  informatieGedeeld:false,feeAkkoord:false,...extra,
});
const contact=(extra:Partial<ContactMoment>={}):ContactMoment=>({
  id:'m1',momentDate:'2026-11-10',direction:'uitgaand',
  type:'teaser_verstuurd',title:'Teaser aangeboden',followUpRequired:false,
  relatieId:'relatie-1',objectId:'object-1',isSystem:false,
  createdAt:'2026-11-10T12:00:00Z',
  updatedAt:'2026-11-10T12:00:00Z',...extra,
});
const callbacks=(extra:any={})=>({
  bestaandeMomenten:[] as ContactMoment[],
  voegKandidaatToe:vi.fn(async (_k: Omit<PipelineKandidaat, 'id' | 'createdAt' | 'updatedAt'>)=>kandidaat()),
  werkKandidaatBij:vi.fn(async (_id:string,_patch:Partial<PipelineKandidaat>)=>undefined),
  voegMomentToe:vi.fn(async (_m: Omit<ContactMoment,'id'|'createdAt'|'updatedAt'|'isSystem'>)=>contact()),
  ...extra,
});

describe('Aanbieding registreren vanaf beide CRM-ingangen',()=>{
  it('maakt bij nieuw aanbod één kandidaat en één contactmoment, zonder berichten te versturen',async()=>{
    const deps=callbacks();
    await registreerAanbieding(input(),deps);
    expect(deps.voegKandidaatToe).toHaveBeenCalledTimes(1);
    expect(deps.voegKandidaatToe.mock.calls[0][0]).toMatchObject({
      objectId:'object-1',relatieId:'relatie-1',
      pipelineFase:'teaser_verstuurd',teaserVerstuurd:true,
      teaserVerstuurdOp:'2026-11-10',informatieGedeeld:false,
    });
    expect(deps.voegMomentToe).toHaveBeenCalledWith(expect.objectContaining({
      type:'teaser_verstuurd',direction:'uitgaand',
      momentDate:'2026-11-10',relatieId:'relatie-1',objectId:'object-1',
      description:expect.stringContaining('WhatsApp'),
    }));
    expect(deps.werkKandidaatBij).not.toHaveBeenCalled();
  });
  it('werkt een bestaande kandidaat bij zonder een tweede kandidaatrecord',async()=>{
    const deps=callbacks({bestaandeKandidaat:kandidaat()});
    await registreerAanbieding(input({soort:'informatie'}),deps);
    expect(deps.voegKandidaatToe).not.toHaveBeenCalled();
    expect(deps.werkKandidaatBij).toHaveBeenCalledWith('k1',expect.objectContaining({
      informatieGedeeld:true,informatieGedeeldOp:'2026-11-10',
      pipelineFase:'informatie_gedeeld',
    }));
    expect(deps.voegMomentToe.mock.calls[0][0].type).toBe('informatie_gedeeld');
  });
  it('zet afgevallen kandidaten of gevorderde trajecten niet terug naar teaser',()=>{
    const patch=kandidaatAanbiedingPatch(
      kandidaat({pipelineFase:'afgevallen',redenAfgevallen:'Prijs te hoog'}),
      input(),
    );
    expect(patch.pipelineFase).toBeUndefined();
    expect(patch.teaserVerstuurd).toBe(true);
    expect(kandidaatAanbiedingPatch(
      kandidaat({pipelineFase:'onderhandeling'}),input({soort:'informatie'}),
    ).pipelineFase).toBeUndefined();
  });
  it('behoudt vroegste aanboddatum in pipeline en legt nieuwe datum apart in tijdlijn',()=>{
    const patch=kandidaatAanbiedingPatch(
      kandidaat({teaserVerstuurd:true,teaserVerstuurdOp:'2026-11-01',
        laatsteContactdatum:'2026-11-09'}),
      input(),
    );
    expect(patch.teaserVerstuurdOp).toBeUndefined();
    expect(patch.laatsteContactdatum).toBe('2026-11-10');
  });
  it('blokkeert dubbele log van dezelfde soort op dezelfde dag en relatie-object',async()=>{
    const deps=callbacks({bestaandeKandidaat:kandidaat(),bestaandeMomenten:[contact()]});
    await expect(registreerAanbieding(input(),deps)).rejects.toThrow(/al als contactmoment/);
    expect(deps.voegMomentToe).not.toHaveBeenCalled();
    expect(deps.werkKandidaatBij).not.toHaveBeenCalled();
    expect(heeftZelfdeAanbieding([contact({relatieId:'andere'})],input())).toBe(false);
    expect(heeftZelfdeAanbieding([contact({objectId:'ander'})],input())).toBe(false);
  });
  it('verhindert toekomstige en onmogelijke aanbieddatums',()=>{
    expect(controleerAanbieding(input({datum:'2030-01-01'}))).toMatch(/pas.*verstuurd/);
    expect(controleerAanbieding(input({datum:'2026-02-30'}))).toMatch(/geldige/);
  });
  it('registreert geen contact als de kandidaatkoppeling mislukt',async()=>{
    const deps=callbacks({voegKandidaatToe:vi.fn().mockRejectedValue(new Error('database niet beschikbaar'))});
    await expect(registreerAanbieding(input(),deps)).rejects.toThrow('database niet beschikbaar');
    expect(deps.voegMomentToe).not.toHaveBeenCalled();
  });
  it('meldt expliciet gedeeltelijke opslag als contactmoment niet lukt',async()=>{
    const deps=callbacks({
      bestaandeKandidaat:kandidaat(),
      voegMomentToe:vi.fn().mockRejectedValue(new Error('Contactmoment opslaan mislukt')),
    });
    await expect(registreerAanbieding(input(),deps))
      .rejects.toBeInstanceOf(GedeeltelijkeAanbiedingRegistratie);
    expect(deps.werkKandidaatBij).toHaveBeenCalledTimes(1);
  });
  it('een teruggelegde historische datum mag de laatste activiteit niet terugzetten',()=>{
    const patch=kandidaatAanbiedingPatch(
      kandidaat({pipelineFase:'indicatieve_bieding',laatsteContactdatum:'2026-11-11'}),
      input({datum:'2026-11-09',soort:'informatie'}),
    );
    expect(patch.laatsteContactdatum).toBeUndefined();
    expect(patch.pipelineFase).toBeUndefined();
  });
  it('neemt letterlijk kanaal en toelichting op, zonder overdracht te claimen',()=>{
    const m=maakAanbiedingsMoment(input({notitie:'IM op verzoek verstuurd'}));
    expect(m.description).toContain('Kanaal: WhatsApp');
    expect(m.description).toContain('IM op verzoek verstuurd');
    expect(m.direction).toBe('uitgaand');
  });
});
