import { type PipelineKandidaat, type Taak, type Deal, VOLGENDE_ACTIE_LABELS } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import { aanbodHistorieVoorRelatie } from '@/lib/relaties/aanbiedingsHistorie';
import { REACTIE_STATUS_LABELS, formatteerAfwijsredenen } from '@/lib/relaties/aanbiedingsReacties';
import { verzamelOpenDossierTaken } from '@/lib/tasks/dossierTaken';
import { isTaakTeLaat } from '@/lib/taakHelpers';

export function kandidaatOpvolging(k:PipelineKandidaat,momenten:readonly ContactMoment[],taken:readonly Taak[],deals:readonly Deal[],now=new Date()){
  const paar=momenten.filter(m=>m.relatieId===k.relatieId&&m.objectId===k.objectId);
  const echteReactie=paar.filter(m=>m.aanbiedingReactie?.versie==='1'&&m.aanbiedingReactie.status!=='geen_reactie')
    .sort((a,b)=>b.momentDate.localeCompare(a.momentDate)||b.createdAt.localeCompare(a.createdAt))[0];
  const contact=paar.filter(m=>['inkomend','uitgaand'].includes(m.direction))
    .sort((a,b)=>b.momentDate.localeCompare(a.momentDate)||b.createdAt.localeCompare(a.createdAt))[0];
  const historie=aanbodHistorieVoorRelatie([k],paar)[0];
  const dealIds=new Set(deals.filter(d=>d.objectId===k.objectId&&d.relatieId===k.relatieId).map(d=>d.id));
  const openTaken=verzamelOpenDossierTaken([taken.filter(t=>
    (t.objectId===k.objectId&&t.relatieId===k.relatieId)||
    (!!t.dealId&&dealIds.has(t.dealId)&&(!t.relatieId||t.relatieId===k.relatieId)&&(!t.objectId||t.objectId===k.objectId))
  )],now);
  const taak=openTaken[0];
  const actief=!['afgevallen','afgerond'].includes(k.pipelineFase)&&echteReactie?.aanbiedingReactie?.status!=='afgewezen';
  const reactie=echteReactie?.aanbiedingReactie;
  const voorstel=reactie?.status==='informatie_gevraagd'?'Aanvullende informatie delen':
    reactie?.status==='interesse'?'Interesse concretiseren':
    historie.bewijs!=='niet_geregistreerd'?'Aanbieding opvolgen':'Koper benaderen / eerdere aanbieding controleren';
  return {
    historie,contact,reactie:reactie?{label:REACTIE_STATUS_LABELS[reactie.status],redenen:formatteerAfwijsredenen(reactie),datum:echteReactie!.momentDate}:null,
    openTaken,taak,teLaat:!!taak&&isTaakTeLaat(taak,now),actief,
    pipelineActie:k.volgendeActie?VOLGENDE_ACTIE_LABELS[k.volgendeActie]:null,
    voorstel:k.volgendeActie?VOLGENDE_ACTIE_LABELS[k.volgendeActie]:voorstel,
  };
}
export type KandidaatOpvolging=ReturnType<typeof kandidaatOpvolging>;
