import {describe,it,expect} from 'vitest';
import type {ObjectVastgoed,Relatie,PipelineKandidaat} from '@/data/mock-data';
import {auditA15Referenties} from './a15ReferentieAudit';

const r=(id:string,softDeletedAt?:string)=>({id,softDeletedAt}) as Relatie;
const o=(id:string,softDeletedAt?:string)=>({id,softDeletedAt}) as ObjectVastgoed;
const p=(id:string,objectId:string,relatieId:string,pipelineFase='match_gevonden')=>
  ({id,objectId,relatieId,pipelineFase}) as PipelineKandidaat;

describe('A15.12 — referentie-audit zonder enige databewerking',()=>{
  it('signaleert archived objecten en telt dezelfde positie maar één keer',()=>{
    const objects=Object.freeze([Object.freeze(o('arch','2026-04-01')),Object.freeze(o('live'))]);
    const relations=Object.freeze([Object.freeze(r('koper')),Object.freeze(r('old','2026-04-02'))]);
    const pipeline=Object.freeze([
      Object.freeze(p('p1','arch','old','indicatieve_bieding')),
      Object.freeze(p('p2','live','koper','onderhandeling')),
      Object.freeze(p('p3','arch','koper','afgevallen')),
    ]);
    const before=JSON.stringify([objects,relations,pipeline]);
    const result=auditA15Referenties(objects,relations,pipeline);
    expect(result).toMatchObject({
      lopendePosities:2,positiesOpGearchiveerdeObjecten:1,
      positiesZonderGeladenObject:0,positiesZonderGeladenRelatie:0,
      positiesMetGearchiveerdeRelatie:1,teVerifiërenPosities:1,
    });
    expect(JSON.stringify([objects,relations,pipeline])).toBe(before);
  });
  it('noemt ontbrekend object niet automatisch gearchiveerd',()=>{
    const result=auditA15Referenties([o('live')],[r('koper')],[
      p('p1','niet-geladen','koper','match_gevonden'),
      p('p2','live','niet-geladen','match_gevonden'),
      p('p3','niet-geladen','niet-geladen','indicatieve_bieding'),
    ]);
    expect(result.positiesOpGearchiveerdeObjecten).toBe(0);
    expect(result.positiesZonderGeladenObject).toBe(2);
    expect(result.positiesZonderGeladenRelatie).toBe(2);
    expect(result.teVerifiërenPosities).toBe(3);
  });
  it('schone lege gegevens hebben geen automatische archiefverdenking',()=>{
    expect(auditA15Referenties([],[],[])).toMatchObject({
      lopendePosities:0,teVerifiërenPosities:0,
    });
  });
});
