import type { Taak } from '@/data/mock-data';
import { getDeadlineDateTime, sorteerTaken } from '@/lib/taakHelpers';
import { isOpenTaskStatus, isTaskOverdue } from '@/lib/tasks/workView';

/**
 * Geen nieuwe taakstatus of planning: op de objectkaart zijn Taken leidend.
 * Neem ook taken mee die alleen aan de unieke concrete Deal zijn gekoppeld.
 * Wachten op reactie is geen achterstallig uitvoerend werk.
 */
export function bepaalCockpitOpvolging(
  objectTaken:readonly Taak[], dealTaken:readonly Taak[]=[], now:Date=new Date(),
) {
  const uniek=new Map<string,Taak>();
  for(const t of [...objectTaken,...dealTaken])uniek.set(t.id,t);
  const open=[...uniek.values()].filter(t=>isOpenTaskStatus(t.status));
  const acties=sorteerTaken(open.filter(t=>t.status!=='wacht_op_reactie'),now);
  const wachtend=sorteerTaken(open.filter(t=>t.status==='wacht_op_reactie'),now);
  const volgende=acties[0]??null;
  return {
    volgende,
    teLaat:volgende?isTaskOverdue(volgende,now):false,
    zonderDeadline:volgende?!getDeadlineDateTime(volgende):false,
    overigeActies:Math.max(0,acties.length-1),
    wachtend,
  };
}

/** Alleen werkbare dossiers krijgen een oproep om opvolging te plannen. */
export function cockpitIsActief(object:{status?:string|null;isArchived?:boolean|null;softDeletedAt?:string|null},stage?:{isWon?:boolean|null;isLost?:boolean|null}|null):boolean {
  return !object.isArchived&&!object.softDeletedAt&&
    !['verkocht','ingetrokken','gearchiveerd'].includes(object.status??'')&&
    !stage?.isWon&&!stage?.isLost;
}
