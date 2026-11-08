import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDataStore } from '@/hooks/useDataStore';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import { websiteVeldLabel,websiteVeldWaarde } from '@/lib/relaties/websiteInvesteerdersvelden';
import {
  redenenVoorBeoordeling,voorstelNieuweRelatie,type ReviewIntake,
} from '@/lib/relaties/websiteIntakeBeoordeling';

type WebsiteIntake = ReviewIntake & {
  id: string;
  created_at: string;
  status: 'ontvangen'|'nieuw_te_controleren'|'bestaande_relatie'|'dubbelzinnig'|'verwerkt'|'afgewezen';
  suggested_relatie_id: string|null;
  processed_relatie_id: string|null;
  review_reason?:string|null;
  raw_payload: ReviewIntake['raw_payload'];
};

const labels: Record<WebsiteIntake['status'], string> = {
  ontvangen:'Te beoordelen',
  nieuw_te_controleren:'Nieuwe relatie — controle nodig',
  bestaande_relatie:'Bestaande relatie — wijzigingen controleren',
  dubbelzinnig:'Mogelijk dubbele relatie',
  verwerkt:'Verwerkt',
  afgewezen:'Afgewezen',
};
const isOpen=(i:WebsiteIntake)=>!['verwerkt','afgewezen'].includes(i.status);
const normaliseer=(s:string)=>s.toLowerCase().trim();
const cijfers=(s:string|null|undefined)=>(s??'').replace(/\D/g,'').slice(-9);

export default function WebsiteInvesteringsprofielenInbox() {
  const store=useDataStore();
  const {propertyTypes}=usePropertyTaxonomie();
  const [expanded,setExpanded]=useState(false);
  const [showProcessed,setShowProcessed]=useState(false);
  const [items,setItems]=useState<WebsiteIntake[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [reviewing,setReviewing]=useState<string|null>(null);
  const [reviewItem,setReviewItem]=useState<WebsiteIntake|null>(null);
  const [reviewTab,setReviewTab]=useState<'algemeen'|'investeerder'>('algemeen');
  const [zoek,setZoek]=useState<Record<string,string>>({});
  const [gekozen,setGekozen]=useState<Record<string,string>>({});
  const [afwijsRedenen,setAfwijsRedenen]=useState<Record<string,string>>({});
  const [afwijzenOpen,setAfwijzenOpen]=useState<string|null>(null);

  const refresh=useCallback(async()=>{
    setLoading(true);
    let query=supabase.from('website_investor_intakes' as any)
      .select('id,applicant_name,applicant_email,applicant_phone,status,suggested_relatie_id,processed_relatie_id,review_reason,raw_payload,created_at')
      .order('created_at',{ascending:false}).limit(50);
    if(!showProcessed)query=query.not('status','in','("verwerkt","afgewezen")');
    const {data,error:queryError}=await query;
    setLoading(false);
    if(queryError){setError('Website-inzendingen konden niet worden opgehaald.');return;}
    setError(null);setItems((data??[]) as unknown as WebsiteIntake[]);
  },[showProcessed]);
  useEffect(()=>{void refresh()},[refresh]);

  // Relaties worden uit de live CRM-store gekozen; geen vrije relatie-ID invoeren.
  const sortedRelaties=useMemo(()=>[...store.relaties].filter(r=>!r.softDeletedAt)
    .sort((a,b)=>a.bedrijfsnaam.localeCompare(b.bedrijfsnaam,'nl')),[store.relaties]);

  const schrijfBeoordeling=async(item:WebsiteIntake,actie:'verwerkt'|'afgewezen',relatieId:string|null,reden:string)=>{
    setReviewing(item.id);
    try {
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError||!auth.user)throw new Error('Geen geldige CRM-sessie');
      const {data,error:updateError}=await supabase.from('website_investor_intakes' as any)
        .update({
          status:actie,processed_relatie_id:actie==='verwerkt'?relatieId:null,
          review_reason:reden.trim(),reviewed_at:new Date().toISOString(),
          reviewed_by:auth.user.id,updated_at:new Date().toISOString(),
        } as any)
        .eq('id',item.id)
        .in('status',['ontvangen','nieuw_te_controleren','bestaande_relatie','dubbelzinnig'])
        .select('id');
      if(updateError||!data?.length)throw new Error('Inzending is gewijzigd of kon niet worden afgehandeld');
      toast.success(actie==='afgewezen'?'Inzending afgewezen':'Inzending gekoppeld en afgerond');
      await store.refresh();
      await refresh();
      return true;
    } catch(err) {
      const message=err instanceof Error?err.message:'Onbekende fout';
      setError(message);toast.error(message);
      return false;
    } finally {setReviewing(null);}
  };

  const bestaandeKandidaten=(item:WebsiteIntake)=>{
    const mail=normaliseer(item.applicant_email);
    const tel=cijfers(item.applicant_phone);
    const naam=normaliseer(item.applicant_name);
    const bedrijf=normaliseer(String(item.raw_payload.fields?.company??''));
    const contactIds=new Set(store.contactpersonen.filter(c=>
      normaliseer(c.email??'')===mail||
      (tel.length===9&&(cijfers(c.telefoon)===tel||cijfers(c.telefoonMobiel)===tel))||
      normaliseer(c.naam??'')===naam,
    ).map(c=>c.relatieId));
    return sortedRelaties.filter(r=>
      r.id===item.suggested_relatie_id||contactIds.has(r.id)||
      normaliseer(r.email??'')===mail||
      (tel.length===9&&cijfers(r.telefoon)===tel)||
      normaliseer(r.contactpersoon??'')===naam||
      (!!bedrijf&&normaliseer(r.bedrijfsnaam)===bedrijf)
    );
  };

  const koppel=async(item:WebsiteIntake)=>{
    const relationId=gekozen[item.id]||item.suggested_relatie_id;
    const relation=sortedRelaties.find(r=>r.id===relationId);
    if(!relation){setError('Kies eerst een bestaande relatie om te koppelen.');return;}
    if(!window.confirm(`Koppel de inzending van ${item.applicant_name} aan ${relation.bedrijfsnaam}? Bestaande aankoopcriteria worden niet overschreven.`))return;
    await schrijfBeoordeling(item,'verwerkt',relation.id,'Handmatig gekoppeld aan bestaande relatie; wijzigingen afzonderlijk beoordelen.');
  };
  const afwijzen=async(item:WebsiteIntake)=>{
    const reden=(afwijsRedenen[item.id]??'').trim();
    if(reden.length<5){setError('Vul een afwijsreden in (minimaal 5 tekens).');return;}
    if(!window.confirm('Deze inzending afwijzen? De oorspronkelijke formuliergegevens blijven bewaard.'))return;
    const ok=await schrijfBeoordeling(item,'afgewezen',null,reden);
    if(ok)setAfwijzenOpen(null);
  };

  const startNieuweRelatie=(item:WebsiteIntake,tab:'algemeen'|'investeerder')=>{
    const duplicates=bestaandeKandidaten(item);
    if(duplicates.length>0){
      setError('Mogelijk bestaat deze relatie al. Koppel eerst een bestaande relatie of controleer de dubbele gegevens.');
      return;
    }
    setReviewTab(tab);setReviewItem(item);
  };
  const created=async(id:string)=>{
    if(!reviewItem)return;
    const snapshot=reviewItem;
    // RelatieFormDialog heeft de relatie en contactpersoon eerst opgeslagen.
    // Bij ontbrekende intake-status blijft de nieuwe relatie bestaan: koppel
    // daarna handmatig aan hetzelfde record, maak géén tweede relatie aan.
    const ok=await schrijfBeoordeling(snapshot,'verwerkt',id,
      'Handmatig gecontroleerd, zo nodig bewerkt, en als nieuwe CRM-relatie aangemaakt.');
    if(!ok)setError(`Relatie ${id} is aangemaakt, maar de intake is nog niet afgehandeld. Koppel deze relatie handmatig; maak geen tweede aan.`);
    setReviewItem(null);
  };

  return <section className="section-card" aria-label="Inkomende investeringsprofielen van website">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <button type="button" onClick={()=>setExpanded(v=>!v)}
        className="flex min-w-0 items-center gap-2 text-left font-semibold text-sm">
        <Inbox className="h-4 w-4 shrink-0" aria-hidden="true"/>
        Website-investeringsprofielen
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {loading?'…':items.length}
        </span>
        {expanded?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}
      </button>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showProcessed} onChange={e=>setShowProcessed(e.target.checked)}/>
          Ook verwerkt tonen
        </label>
        <button type="button" onClick={()=>void refresh()} disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5"/> Verversen
        </button>
      </div>
    </div>
    {expanded&&<div className="space-y-3 border-t border-border p-4">
      <p className="text-xs text-muted-foreground">
        Goedkeuren of bewerken opent de bestaande relatie-editor met ingevulde
        websitegegevens. Koppelen wijzigt nooit bestaande aankoopcriteria.
        Afwijzen bewaart de bron en de afwijsreden.
      </p>
      {error&&<p role="alert" className="rounded-md border border-destructive/30 p-2 text-sm text-destructive">{error}</p>}
      {!loading&&!error&&items.length===0&&<p className="text-sm text-muted-foreground">Geen openstaande inzendingen.</p>}
      {items.map(item=>{
        const search=normaliseer(zoek[item.id]??'');
        const matches=bestaandeKandidaten(item);
        const searchable=sortedRelaties.filter(r=>search&&(
          normaliseer(r.bedrijfsnaam).includes(search)||
          normaliseer(r.contactpersoon??'').includes(search)||
          normaliseer(r.email??'').includes(search)))
          .slice(0,25);
        const options=[...matches,...searchable.filter(r=>!matches.some(m=>m.id===r.id))];
        const selected=gekozen[item.id]||item.suggested_relatie_id||'';
        const reason=redenenVoorBeoordeling(item,item.status);
        const canCreate=isOpen(item)&&matches.length===0;
        return <details key={item.id} className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><strong className="block text-sm">{item.applicant_name}</strong>
                <span className="block break-all text-xs text-muted-foreground">{item.applicant_email}</span>
              </div>
              <div className="text-right">
                <span className="block text-xs font-medium">{labels[item.status]}</span>
                <time className="text-xs text-muted-foreground" dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleDateString('nl-NL')}
                </time>
              </div>
            </div>
          </summary>
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {item.applicant_phone&&<p className="text-xs">Telefoon: {item.applicant_phone}</p>}
            {item.processed_relatie_id&&<Link to={`/relaties/${item.processed_relatie_id}`}
              className="text-sm underline underline-offset-2">Open gekoppelde relatie</Link>}
            {item.review_reason&&<p className="text-xs text-muted-foreground">Afhandeling: {item.review_reason}</p>}
            {isOpen(item)&&<>
              <div className="rounded-md bg-muted/40 p-3 text-xs">
                <strong>Waarom beoordelen?</strong>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {reason.map(x=><li key={x}>{x}</li>)}
                </ul>
              </div>
              {matches.length>0&&<p className="text-xs text-amber-700 dark:text-amber-300">
                {matches.length} mogelijke bestaande relatie(s) gevonden. Geen tweede relatie aanmaken zonder te controleren.
              </p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!canCreate||reviewing===item.id}
                  onClick={()=>startNieuweRelatie(item,'algemeen')}
                  className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-foreground disabled:opacity-50">
                  Goedkeuren als nieuwe relatie
                </button>
                <button type="button" disabled={!canCreate||reviewing===item.id}
                  onClick={()=>startNieuweRelatie(item,'investeerder')}
                  className="rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-50">
                  Bewerken vóór goedkeuren
                </button>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <label className="block text-xs font-medium" htmlFor={`relatie-search-${item.id}`}>
                  Koppelen aan bestaande relatie
                </label>
                <input id={`relatie-search-${item.id}`} value={zoek[item.id]??''}
                  onChange={e=>setZoek(x=>({...x,[item.id]:e.target.value}))}
                  placeholder="Zoek naam, bedrijf of e-mailadres"
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"/>
                <select value={selected} onChange={e=>setGekozen(x=>({...x,[item.id]:e.target.value}))}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  aria-label="Kies bestaande relatie">
                  <option value="">— Kies een relatie —</option>
                  {options.map(r=><option key={r.id} value={r.id}>
                    {r.bedrijfsnaam} ({r.email||r.contactpersoon||'geen e-mail'})
                  </option>)}
                  {selected&&!options.some(r=>r.id===selected)&&
                    <option value={selected}>Geselecteerde relatie — opnieuw controleren</option>}
                </select>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" disabled={!sortedRelaties.some(r=>r.id===selected)||reviewing===item.id}
                    onClick={()=>void koppel(item)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                    Koppelen en afronden
                  </button>
                  {selected&&sortedRelaties.some(r=>r.id===selected)&&
                    <Link to={`/relaties/${selected}`} className="text-xs underline underline-offset-2">
                      Bestaande relatie bewerken
                    </Link>}
                </div>
              </div>
              {afwijzenOpen===item.id?
                <div className="space-y-2 rounded-md border border-border p-3">
                  <label htmlFor={`reden-${item.id}`} className="block text-xs font-medium">Reden van afwijzing</label>
                  <textarea id={`reden-${item.id}`} value={afwijsRedenen[item.id]??''}
                    onChange={e=>setAfwijsRedenen(x=>({...x,[item.id]:e.target.value}))}
                    className="w-full rounded-md border border-input bg-background p-2 text-sm" rows={2}
                    placeholder="Bijv. dubbele inzending, geen relevant vastgoedprofiel…"/>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>void afwijzen(item)} disabled={reviewing===item.id}
                      className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">
                      Afwijzing bevestigen
                    </button>
                    <button type="button" onClick={()=>setAfwijzenOpen(null)} className="text-xs">Annuleren</button>
                  </div>
                </div>:
                <button type="button" onClick={()=>setAfwijzenOpen(item.id)}
                  className="text-xs text-muted-foreground underline underline-offset-2">
                  Afwijzen
                </button>
              }
            </>}
            <details className="rounded-md bg-muted/20 p-2" open>
              <summary className="text-xs font-medium">Oorspronkelijke formulierantwoorden</summary>
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(item.raw_payload?.fields??{}).map(([key,value])=>
                  <div key={key} className="rounded-md bg-muted/40 p-2 text-xs">
                    <dt className="font-medium break-all">{websiteVeldLabel(key)}</dt>
                    <dd className="break-words text-muted-foreground">{websiteVeldWaarde(value)}</dd>
                  </div>)}
              </dl>
            </details>
          </div>
        </details>;
      })}
    </div>}
    {reviewItem&&<RelatieFormDialog
      open={!!reviewItem}
      onOpenChange={open=>{if(!open)setReviewItem(null)}}
      initialValues={voorstelNieuweRelatie(reviewItem,propertyTypes)}
      initialPrimaireContactpersoon={{
        naam:reviewItem.applicant_name,
        email:reviewItem.applicant_email,
        telefoon:reviewItem.applicant_phone??'',
      }}
      initialTab={reviewTab}
      onCreated={id=>{void created(id)}}
    />}
  </section>;
}
