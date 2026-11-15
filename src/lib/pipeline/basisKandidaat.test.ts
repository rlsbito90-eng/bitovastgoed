import { describe, it, expect } from 'vitest';
import { maakBasisKandidaat } from './basisKandidaat';

describe('één basisregistratie voor kandidaat uit relatie of object',()=>{
  it('maakt een koppeling zonder aanbod of bieding te claimen',()=>{
    const k=maakBasisKandidaat({objectId:'o',relatieId:'r'});
    expect(k).toMatchObject({objectId:'o',relatieId:'r',pipelineFase:'match_gevonden',
      teaserVerstuurd:false,ndaVerstuurd:false,ndaGetekend:false,
      informatieGedeeld:false,feeAkkoord:false});
    expect(k.zoekprofielId).toBeUndefined();
    expect(k.biedingBedrag).toBeUndefined();
  });
  it('neemt uitsluitend expliciete zoekprofielkeuze en score over',()=>{
    const k=maakBasisKandidaat({objectId:'o',relatieId:'r',zoekprofielId:'z',matchscore:73});
    expect(k.zoekprofielId).toBe('z');
    expect(k.matchscore).toBe(73);
    expect(maakBasisKandidaat({objectId:'o',relatieId:'r',matchscore:NaN}).matchscore).toBeUndefined();
  });
});
