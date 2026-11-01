import type { LeadStatus } from '@/data/mock-data';
import {
  normaalProfielFilter,
  type RelatieProfielFilter,
} from '@/lib/relaties/relatieProfielFilter';

export interface RelatiesViewState {
  zoek:string;
  statusFilter:LeadStatus|'';
  profielFilter:RelatieProfielFilter;
}

const KEY='crm:relaties:view-state:v2';
const OUD_KEY='crm:relaties:view-state:v1';
const STATUSSEN=new Set(['koud','lauw','warm','actief']);

export const DEFAULT_RELATIES_VIEW_STATE:RelatiesViewState={
  zoek:'',statusFilter:'',profielFilter:'',
};

/** v1 -> v2: een eerder gekozen oud hoofdtype blijft exact als
 * historisch filter werken; geen onbewezen partijprofiel afleiden. */
export function loadRelatiesViewState():RelatiesViewState{
  try{
    const nieuw=sessionStorage.getItem(KEY);
    const oud=nieuw?null:sessionStorage.getItem(OUD_KEY);
    if(!nieuw&&!oud)return DEFAULT_RELATIES_VIEW_STATE;
    const parsed=JSON.parse(nieuw??oud??'{}') as Record<string,unknown>;
    const profielFilter=nieuw
      ?normaalProfielFilter(parsed.profielFilter)
      :normaalProfielFilter(typeof parsed.typeFilter==='string'
        ?`legacy:${parsed.typeFilter}`:'');
    return{
      zoek:typeof parsed.zoek==='string'?parsed.zoek:'',
      statusFilter:STATUSSEN.has(String(parsed.statusFilter??''))
        ? parsed.statusFilter as LeadStatus:'',
      profielFilter,
    };
  }catch{return DEFAULT_RELATIES_VIEW_STATE;}
}

export function saveRelatiesViewState(state:RelatiesViewState):void{
  try{sessionStorage.setItem(KEY,JSON.stringify(state));}
  catch{ /* zonder sessionStorage blijft de lijst functioneren */ }
}
