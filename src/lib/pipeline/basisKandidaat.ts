import type { PipelineKandidaat } from '@/data/mock-data';

export type BasisKandidaatInvoer = Omit<PipelineKandidaat, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Eén consistente startstatus voor een handmatig gekozen kandidaat.
 * Een match of koppeling registreert nooit automatisch een aanbieding,
 * contactmoment, bieding of instemming met courtage.
 */
export function maakBasisKandidaat({
  objectId,relatieId,zoekprofielId,matchscore,
}:{
  objectId:string;
  relatieId:string;
  zoekprofielId?:string|null;
  matchscore?:number|null;
}):BasisKandidaatInvoer {
  if (!objectId || !relatieId) throw new Error('Object en relatie zijn verplicht');
  return {
    objectId,
    relatieId,
    ...(zoekprofielId ? {zoekprofielId} : {}),
    pipelineFase:'match_gevonden',
    interesseNiveau:'lauw',
    ...(matchscore!=null && Number.isFinite(matchscore) ? {matchscore} : {}),
    teaserVerstuurd:false,
    ndaVerstuurd:false,
    ndaGetekend:false,
    informatieGedeeld:false,
    feeAkkoord:false,
  };
}
