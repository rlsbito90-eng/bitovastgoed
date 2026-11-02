import type {ObjectVastgoed,PipelineKandidaat,Relatie} from '@/data/mock-data';

/**
 * A15.12: audit van referenties voor de release, uitsluitend op geladen data.
 * 'Niet geladen' is niet automatisch 'verwijderd': de oude object-/relatierij
 * kan gearchiveerd zijn of bewust buiten het actieve gegevenspakket vallen.
 */
export type A15ReferentieAudit={
  lopendePosities:number;
  positiesOpGearchiveerdeObjecten:number;
  positiesZonderGeladenObject:number;
  positiesZonderGeladenRelatie:number;
  positiesMetGearchiveerdeRelatie:number;
  teVerifiërenPosities:number;
};
export function auditA15Referenties(
  objecten:readonly Pick<ObjectVastgoed,'id'|'softDeletedAt'>[],
  relaties:readonly Pick<Relatie,'id'|'softDeletedAt'>[],
  pipeline:readonly Pick<PipelineKandidaat,'objectId'|'relatieId'|'pipelineFase'>[],
):A15ReferentieAudit{
  const byObject=new Map(objecten.map(o=>[o.id,o]));
  const byRelatie=new Map(relaties.map(r=>[r.id,r]));
  const result:A15ReferentieAudit={
    lopendePosities:0,
    positiesOpGearchiveerdeObjecten:0,
    positiesZonderGeladenObject:0,
    positiesZonderGeladenRelatie:0,
    positiesMetGearchiveerdeRelatie:0,
    teVerifiërenPosities:0,
  };
  for(const p of pipeline){
    if(p.pipelineFase==='afgevallen'||p.pipelineFase==='afgerond')continue;
    result.lopendePosities++;
    const object=byObject.get(p.objectId);
    const relatie=byRelatie.get(p.relatieId);
    const objectArchief=!!object?.softDeletedAt;
    const objectOntbreekt=!object;
    const relatieArchief=!!relatie?.softDeletedAt;
    const relatieOntbreekt=!relatie;
    if(objectArchief)result.positiesOpGearchiveerdeObjecten++;
    if(objectOntbreekt)result.positiesZonderGeladenObject++;
    if(relatieArchief)result.positiesMetGearchiveerdeRelatie++;
    if(relatieOntbreekt)result.positiesZonderGeladenRelatie++;
    // Eén pipelinepositie kan meer dan één kwestie hebben.
    if(objectArchief||objectOntbreekt||relatieArchief||relatieOntbreekt)
      result.teVerifiërenPosities++;
  }
  return result;
}
