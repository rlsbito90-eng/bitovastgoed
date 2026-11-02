import type { Partijprofiel, PartijType, Relatie } from '@/data/mock-data';
import { PARTIJPROFIELEN, labelPartijprofiel } from '@/lib/relaties/partijprofiel';

export type RelatieProfielFilter = '' | 'zonder_profiel'
  | `profiel:${Partijprofiel}` | `legacy:${PartijType}`;

export const HISTORISCHE_HOOFDTYPEN: readonly PartijType[] =
  ['belegger','ontwikkelaar','eigenaar','makelaar','partner','overig'];

const historisch = new Set<string>(HISTORISCHE_HOOFDTYPEN);
const profielen = new Set<string>(PARTIJPROFIELEN.map(p=>p.value));

export function normaalProfielFilter(waarde:unknown):RelatieProfielFilter {
  if(waarde===''||waarde==='zonder_profiel')return waarde;
  if(typeof waarde!=='string')return '';
  if(waarde.startsWith('profiel:')&&profielen.has(waarde.slice(8)))
    return waarde as RelatieProfielFilter;
  if(waarde.startsWith('legacy:')&&historisch.has(waarde.slice(7)))
    return waarde as RelatieProfielFilter;
  return '';
}

/** Eerst expliciet gevalideerde nieuwe classificatie; nooit een oude default
 * (vaak 'belegger') als bewezen beleggersprofiel presenteren. */
export function relatieProfielLabel(r:Pick<Relatie,'partijprofiel'>):string {
  return r.partijprofiel ? labelPartijprofiel(r.partijprofiel) : 'Nog niet geclassificeerd';
}

/** Historische filters zijn bewust beschikbaar maar duidelijk afgescheiden
 * van het huidige partijprofiel, tot het uitfaseringsproject is voltooid. */
export function matchRelatieProfiel(
  r:Pick<Relatie,'partijprofiel'|'type'>,filter:RelatieProfielFilter
):boolean {
  if(!filter)return true;
  if(filter==='zonder_profiel')return r.partijprofiel==null;
  if(filter.startsWith('profiel:'))return r.partijprofiel===filter.slice(8);
  if(filter.startsWith('legacy:'))return r.type===filter.slice(7);
  return false;
}
