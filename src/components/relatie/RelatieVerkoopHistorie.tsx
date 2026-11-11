import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ObjectVastgoed } from '@/data/mock-data';
import { OBJECT_STATUS_LABELS,formatDate } from '@/data/mock-data';
import { gekoppeldeVerkoopobjecten } from '@/lib/relaties/objectVerkoopHistorie';
import {
  OBJECT_PARTIJ_ROLLEN,AANLEVER_KANALEN,
  laadRelatiePartijen,laadRelatieAanleveringen,uniekeAanbodObjectIds,
  type ObjectPartij,type ObjectAanlevering,
} from '@/lib/objecten/aanbodHerkomst';

interface Props {
  relatieId: string;
  objecten: readonly ObjectVastgoed[];
}

/** Eén relatiekaart combineert de legacy verkoop-FK, meerdere objectrollen
 * en expliciete aanlevermomenten, zonder drie verschillende pipelines.
 */
export default function RelatieVerkoopHistorie({relatieId,objecten}:Props) {
  const [rollen,setRollen]=useState<ObjectPartij[]>([]);
  const [aanleveringen,setAanleveringen]=useState<ObjectAanlevering[]>([]);
  const [laden,setLaden]=useState(true);
  const [fout,setFout]=useState<string|null>(null);

  useEffect(()=>{
    let actief=true;
    setLaden(true);setFout(null);
    void Promise.all([laadRelatiePartijen(relatieId),laadRelatieAanleveringen(relatieId)])
      .then(([r,a])=>{
        if(!actief)return;
        setRollen(r);setAanleveringen(a);
      }).catch(e=>{
        if(!actief)return;
        setFout(e instanceof Error?e.message:'Herkomsthistorie niet beschikbaar');
        setRollen([]);setAanleveringen([]);
      }).finally(()=>{if(actief)setLaden(false);});
    return ()=>{actief=false;};
  },[relatieId]);

  const historisch=gekoppeldeVerkoopobjecten(relatieId,objecten);
  const ids=uniekeAanbodObjectIds(historisch.map(x=>x.id),rollen,aanleveringen);
  const idSet=new Set(ids);
  const gekoppeld=objecten.filter(o=>idSet.has(o.id)&&!o.softDeletedAt)
    .sort((a,b)=>{
      const latest=(o:ObjectVastgoed)=>
        aanleveringen.filter(x=>x.objectId===o.id)
          .reduce((m,x)=>x.aangeleverdOp>m?x.aangeleverdOp:m,o.datumToegevoegd??'');
      return latest(b).localeCompare(latest(a));
    });
  const beschikbaar=gekoppeld.filter(o=>o.status==='beschikbaar'&&!o.isArchived).length;
  const verkocht=gekoppeld.filter(o=>o.status==='verkocht').length;
  const aantoonbaarAangebracht=new Set([
    ...aanleveringen.map(a=>a.objectId),
    ...rollen.filter(r=>r.rol==='aanbrenger').map(r=>r.objectId),
  ]).size;

  return <section className="section-card p-5 sm:p-6 space-y-3"
    data-testid="relatie-verkoop-historie">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="section-title">Aanbod- en aanleverhistorie</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Gekoppelde verkoopdossiers, betrokken rollen en daadwerkelijke aanlevermomenten.
        </p>
      </div>
      <span className="text-xs font-medium border rounded-md px-2 py-1">
        {gekoppeld.length} {gekoppeld.length===1?'object':'objecten'}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
      <div><strong className="text-foreground">{aanleveringen.length}</strong> geregistreerde aanlevermomenten</div>
      <div><strong className="text-foreground">{aantoonbaarAangebracht}</strong> objecten als aanbrenger/aanleveraar</div>
      <div>{beschikbaar} beschikbaar</div>
      <div>{verkocht} verkocht</div>
    </div>
    {fout&&<p role="alert" className="text-xs text-destructive">
      Aanvullende herkomstgegevens nog niet geladen ({fout}).
      De bestaande relatiekoppelingen blijven hieronder zichtbaar.
    </p>}
    {laden&&<p className="text-xs text-muted-foreground">Aanleverhistorie laden…</p>}
    {gekoppeld.length===0?
      <p className="text-sm text-muted-foreground">
        Nog geen gekoppeld aanbod. Registreer een betrokken rol of een
        aanlevermoment via het betreffende object.
      </p>
      :<div className="divide-y divide-border/70">
        {gekoppeld.map(o=>{
          const events=aanleveringen.filter(x=>x.objectId===o.id)
            .sort((a,b)=>b.aangeleverdOp.localeCompare(a.aangeleverdOp));
          const objectRollen=rollen.filter(x=>x.objectId===o.id);
          const isLegacy=o.eigenaarRelatieId===relatieId;
          return <Link key={o.id} to={'/objecten/'+o.id}
            className="block py-3 hover:bg-muted/40 rounded px-1">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="text-sm font-medium break-words">{o.titel}</p>
              <span className="text-xs text-muted-foreground">
                {OBJECT_STATUS_LABELS[o.status]??o.status}
                {o.isArchived?' · Archief':''}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {[o.plaats,o.provincie].filter(Boolean).join(' · ')||'Locatie onbekend'}
              {' · '}
              {o.datumToegevoegd
                ?'Geregistreerd '+formatDate(o.datumToegevoegd)
                :'Registratiedatum onbekend'}
            </p>
            {(isLegacy||objectRollen.length>0)&&<p className="text-xs text-muted-foreground mt-1">
              {[
                ...(isLegacy?['Primaire verkooprelatie (oud)']:[]),
                ...objectRollen.map(r=>OBJECT_PARTIJ_ROLLEN[r.rol]),
              ].join(' · ')}
            </p>}
            {events.length>0&&<div className="mt-1 space-y-0.5">
              {events.map(e=><p key={e.id} className="text-xs text-foreground">
                Aangeleverd {formatDate(e.aangeleverdOp)} via {AANLEVER_KANALEN[e.kanaal]}
                {e.toelichting?' · '+e.toelichting:''}
              </p>)}
            </div>}
          </Link>;
        })}
      </div>}
    <p className="text-xs text-muted-foreground">
      Unieke objecten worden één keer geteld, ook bij meerdere rollen of aanleveringen.
      Een aanlevermoment telt afzonderlijk. De CRM-registratiedatum is niet
      noodzakelijk de datum waarop dit aanbod werd aangebracht.
    </p>
  </section>;
}
