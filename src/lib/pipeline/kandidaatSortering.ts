import { PIPELINE_FASES, type InteresseNiveau, type PipelineFase } from '@/data/mock-data';

export type KandidaatSorteerwijze =
  | 'aanbevolen' | 'recent' | 'interesse' | 'fase' | 'vervolg' | 'naam';

export const KANDIDAAT_SORTEEROPTIES: readonly {value:KandidaatSorteerwijze;label:string}[]=[
  {value:'aanbevolen',label:'Actief eerst · opvolging'},
  {value:'recent',label:'Laatste activiteit · nieuwste eerst'},
  {value:'interesse',label:'Interesse · hoogste eerst'},
  {value:'fase',label:'Pipelinefase · verst gevorderd eerst'},
  {value:'vervolg',label:'Volgende actie · eerstvolgende eerst'},
  {value:'naam',label:'Naam · A tot Z'},
];

export interface SorteerbareKandidaat {
  id:string;
  pipelineFase:PipelineFase;
  interesseNiveau:InteresseNiveau;
  matchscore?:number | null;
  laatsteContactdatum?:string | null;
  volgendeActieDatum?:string | null;
}

const interesses:Record<InteresseNiveau,number>={
  koud:0,lauw:1,warm:2,zeer_warm:3,
};
const faseRang=new Map(PIPELINE_FASES.map((fase,i)=>[fase.key,i]));
const actiefRang=(fase:PipelineFase)=>
  fase==='afgevallen'?2:fase==='afgerond'?1:0;
const geldigeDatum=(d:string|null|undefined)=>
  typeof d==='string'&&/^\d{4}-\d{2}-\d{2}/.test(d)?d:null;
const nieuwsteEerst=(a:string|null|undefined,b:string|null|undefined)=>{
  const aa=geldigeDatum(a),bb=geldigeDatum(b);
  return aa===null?(bb===null?0:1):bb===null?-1:bb.localeCompare(aa);
};
const eerstvolgend=(a:string|null|undefined,b:string|null|undefined)=>{
  const aa=geldigeDatum(a),bb=geldigeDatum(b);
  return aa===null?(bb===null?0:1):bb===null?-1:aa.localeCompare(bb);
};

/**
 * Puur zichtbare volgorde: bestaande records en CRM-opslag worden niet gewijzigd.
 * Een kandidaat die handmatig is gekoppeld blijft in de lijst, ook na afwijzing.
 */
export function sorteerObjectKandidaten<T extends SorteerbareKandidaat>(
  kandidaten:readonly T[],
  sortering:KandidaatSorteerwijze,
  naam:(k:T)=>string,
):T[]{
  return kandidaten.map((k,index)=>({k,index})).sort((a,b)=>{
    const x=a.k,y=b.k;
    const byNaam=()=>naam(x).localeCompare(naam(y),'nl',{sensitivity:'base'});
    let verschil=0;
    switch(sortering){
      case 'aanbevolen':
        verschil=actiefRang(x.pipelineFase)-actiefRang(y.pipelineFase)
          ||eerstvolgend(x.volgendeActieDatum,y.volgendeActieDatum)
          ||interesses[y.interesseNiveau]-interesses[x.interesseNiveau]
          ||nieuwsteEerst(x.laatsteContactdatum,y.laatsteContactdatum);
        break;
      case 'recent':
        verschil=nieuwsteEerst(x.laatsteContactdatum,y.laatsteContactdatum);
        break;
      case 'interesse':
        verschil=interesses[y.interesseNiveau]-interesses[x.interesseNiveau];
        break;
      case 'fase':
        // Afgerond/afgevallen worden geen fictieve positieve voortgang.
        verschil=actiefRang(x.pipelineFase)-actiefRang(y.pipelineFase)
          ||(faseRang.get(y.pipelineFase)??-1)-(faseRang.get(x.pipelineFase)??-1);
        break;
      case 'vervolg':
        verschil=eerstvolgend(x.volgendeActieDatum,y.volgendeActieDatum);
        break;
      case 'naam':
        verschil=byNaam();
        break;
    }
    // Gelijke opvolgingscriteria: stabiel op oorspronkelijke volgorde.
    return verschil || a.index-b.index;
  }).map(({k})=>k);
}
