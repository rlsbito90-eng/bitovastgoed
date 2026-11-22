// Rustige taakdetailpagina: de taak zelf centraal, gewone gegevens direct bewerkbaar.
// Bij juridische of procesmatige acties (afronden, verwijderen) blijft bevestiging nodig.
import {useCallback,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useLocation,useNavigate,useParams,Link} from 'react-router-dom';
import {toast} from 'sonner';
import {
  ArrowLeft,CheckCircle2,RotateCcw,Trash2,Ellipsis,ExternalLink,
  UserRound,Building2,BriefcaseBusiness,Radar,Plus,
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {PrioriteitBadge,TaakStatusBadge} from '@/components/StatusBadges';
import {useDataStore} from '@/hooks/useDataStore';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import TaakAfrondenDialog from '@/components/forms/TaakAfrondenDialog';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import {TAAK_TYPES} from '@/lib/taakHelpers';
import {InlineDossierTekst,InlineDossierKeuze} from '@/components/ui/inline-dossier-waarde';
import {getRelatieNaamCompact} from '@/lib/relatieNaam';
import {useOffMarketSignaal} from '@/hooks/useOffMarketSignalen';
import {leesCrmReturnContext} from '@/lib/crmReturnContext';
import {getTaskPlanning,type TaskPlanningMeta} from '@/lib/tasks/planning';
import TaakPlanningDetail from '@/components/tasks/TaakPlanningDetail';
import TaskLinksPickerDialog,{
  taskLinkSelectionFromLegacy,countTaskLinks,type TaskLinkSelection,
} from '@/components/tasks/TaskLinksPickerDialog';
import {listTaskLinks,replaceTaskLinks,type TaskLinkEntityType} from '@/lib/tasks/links';
import type {Taak} from '@/data/mock-data';

const rowClass='flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2 text-left';
type LinkKind='relatie'|'object'|'deal'|'signaal';
const linkLabels:Record<LinkKind,string>={
  relatie:'Relatie',object:'Object',deal:'Deal',signaal:'Off-market signaal',
};
const linkIcons:Record<LinkKind,ReactNode>={
  relatie:<UserRound className="h-4 w-4"/>,
  object:<Building2 className="h-4 w-4"/>,
  deal:<BriefcaseBusiness className="h-4 w-4"/>,
  signaal:<Radar className="h-4 w-4"/>,
};

function mergedLinks(task:Taak,rows:Awaited<ReturnType<typeof listTaskLinks>>):TaskLinkSelection {
  const base=taskLinkSelectionFromLegacy(task);
  for(const row of rows){
    if(!base[row.entityType].includes(row.entityId)){
      base[row.entityType].push(row.entityId);
    }
  }
  return base;
}
function linksForSave(selected:TaskLinkSelection){
  return (Object.entries(selected) as [TaskLinkEntityType,string[]][])
    .flatMap(([entityType,ids])=>ids.map((entityId,index)=>({
      entityType,entityId,isPrimary:index===0,
    })));
}

export default function TaakDetailPage(){
  const {id}=useParams<{id:string}>();
  const navigate=useNavigate();
  const location=useLocation();
  const {
    taken,getRelatieById,getDealById,getObjectById,updateTaak,deleteTaak,contactpersonen,
  }=useDataStore();
  const returnContext=leesCrmReturnContext(location.state);
  const returnPad=returnContext?.path??'/taken';
  const returnLabel=returnContext?.label??'Taken';
  const taak=useMemo(()=>taken.find(t=>t.id===id)??null,[taken,id]);

  const [editOpen,setEditOpen]=useState(false);
  const [afrondenOpen,setAfrondenOpen]=useState(false);
  const [verwijderOpen,setVerwijderOpen]=useState(false);
  const [planning,setPlanning]=useState<TaskPlanningMeta|null>(null);
  const [planningLoading,setPlanningLoading]=useState(true);
  const [planningError,setPlanningError]=useState<string|null>(null);
  const [planningRefresh,setPlanningRefresh]=useState(0);
  const [links,setLinks]=useState<TaskLinkSelection|null>(null);
  const [linksLoading,setLinksLoading]=useState(true);
  const [linksError,setLinksError]=useState<string|null>(null);
  const [linksRefresh,setLinksRefresh]=useState(0);
  const [linksOpen,setLinksOpen]=useState(false);
  const [linksDraft,setLinksDraft]=useState<TaskLinkSelection>(taskLinkSelectionFromLegacy({}));
  const [savingLinks,setSavingLinks]=useState(false);

  const signaal=useOffMarketSignaal(taak?.offMarketSignaalId??undefined).data;
  const loadPlanning=useCallback(async()=>{
    if(!id)return;
    const row=await getTaskPlanning(id);
    setPlanning(row);
  },[id]);
  useEffect(()=>{
    if(!id){setPlanning(null);setPlanningLoading(false);return;}
    let cancelled=false;
    setPlanningLoading(true);setPlanningError(null);
    void getTaskPlanning(id)
      .then(row=>{if(!cancelled){setPlanning(row);setPlanningLoading(false);}})
      .catch(err=>{
        console.error('Taakplanning laden mislukt',err);
        if(!cancelled){setPlanning(null);setPlanningError('Planning kon niet worden geladen.');setPlanningLoading(false);}
      });
    return ()=>{cancelled=true;};
  },[id,planningRefresh]);

  useEffect(()=>{
    if(!taak){setLinks(null);setLinksLoading(false);return;}
    let cancelled=false;
    setLinksLoading(true);setLinksError(null);
    void listTaskLinks(taak.id)
      .then(rows=>{if(!cancelled){setLinks(mergedLinks(taak,rows));setLinksLoading(false);}})
      .catch(err=>{
        console.error('Taakkoppelingen laden mislukt',err);
        if(!cancelled){setLinks(null);setLinksError('Koppelingen konden niet worden geladen.');setLinksLoading(false);}
      });
    return ()=>{cancelled=true;};
  },[taak?.id,taak?.relatieId,taak?.objectId,taak?.dealId,taak?.offMarketSignaalId,linksRefresh]);

  if(!taak){
    return <div className="page-shell max-w-3xl space-y-4">
      <Button variant="ghost" onClick={()=>navigate(returnPad)}><ArrowLeft className="mr-2 h-4 w-4"/>Terug naar {returnLabel}</Button>
      <p className="py-8 text-center text-sm text-muted-foreground">Taak niet gevonden.</p>
    </div>;
  }

  const isAfgerond=taak.status==='afgerond';
  const activeLinks=links??taskLinkSelectionFromLegacy(taak);
  const relatieId=activeLinks.relatie[0]||null;
  const objectId=activeLinks.object[0]||null;
  const dealId=activeLinks.deal[0]||null;
  const signaalId=activeLinks.signaal[0]||null;
  const relatie=relatieId?getRelatieById(relatieId):null;
  const deal=dealId?getDealById(dealId):null;
  const object=objectId?getObjectById(objectId):null;
  const derivedObject=object||(deal?getObjectById(deal.objectId):null);
  const extraLinks=countTaskLinks(activeLinks)-(['relatie','object','deal','signaal'] as LinkKind[])
    .filter(key=>activeLinks[key].length>0).length;

  const openLinks=()=>{
    if(linksLoading||linksError||!links||savingLinks)return;
    setLinksDraft({
      relatie:[...links.relatie],object:[...links.object],
      deal:[...links.deal],signaal:[...links.signaal],
    });
    setLinksOpen(true);
  };
  const saveLinks=async(next:TaskLinkSelection)=>{
    if(!links||linksLoading||linksError||savingLinks)return;
    setSavingLinks(true);
    try{
      await updateTaak(taak.id,{
        relatieId:next.relatie[0]||undefined,
        objectId:next.object[0]||undefined,
        dealId:next.deal[0]||undefined,
        offMarketSignaalId:next.signaal[0]||undefined,
      });
      await replaceTaskLinks(taak.id,linksForSave(next));
      setLinks({
        relatie:[...next.relatie],object:[...next.object],
        deal:[...next.deal],signaal:[...next.signaal],
      });
      setLinksOpen(false);
      setLinksRefresh(v=>v+1);
      toast.success('Koppelingen opgeslagen');
    }catch(err){
      toast.error(err instanceof Error?err.message:'Koppelingen opslaan mislukt');
      setLinksRefresh(v=>v+1);
    }finally{setSavingLinks(false);}
  };
  const heropen=async()=>{
    try{await updateTaak(taak.id,{status:'open'});toast.success('Taak heropend');}
    catch(err){toast.error(err instanceof Error?err.message:'Heropenen mislukt');}
  };
  const verwijderen=async()=>{
    try{await deleteTaak(taak.id);toast.success('Taak verwijderd');navigate(returnPad);}
    catch(err){toast.error(err instanceof Error?err.message:'Verwijderen mislukt');}
  };

  const linksView:Record<LinkKind,{naam:string|null;href:string|null}>={
    relatie:{
      naam:relatie?getRelatieNaamCompact(relatie,contactpersonen):relatieId?'Relatie laden…':null,
      href:relatieId?`/relaties/${relatieId}`:null,
    },
    object:{
      naam:derivedObject?.titel||derivedObject?.adres||(objectId?'Object laden…':null),
      href:objectId?`/objecten/${objectId}`:null,
    },
    deal:{
      naam:deal?(getObjectById(deal.objectId)?.titel||getObjectById(deal.objectId)?.adres||'Deal'):dealId?'Deal laden…':null,
      href:dealId?`/deals/${dealId}`:null,
    },
    signaal:{
      naam:signaal?(signaal.titel||signaal.adres||'Signaal'):signaalId?'Signaal laden…':null,
      href:signaalId?`/off-market/${signaalId}`:null,
    },
  };

  return <div className="page-shell mx-auto max-w-3xl space-y-4 pb-10">
    <header className="flex items-center justify-between gap-2">
      <button type="button" onClick={()=>navigate(returnPad)}
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="h-4 w-4"/> {returnLabel}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Meer taakacties">
            <Ellipsis className="h-5 w-5"/>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onSelect={()=>setEditOpen(true)} className="min-h-10">
            Uitgebreid bewerken
          </DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onSelect={()=>setVerwijderOpen(true)} className="min-h-10 text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4"/>Taak verwijderen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <section className="space-y-3 px-1">
      <InlineDossierTekst key={taak.id+'-titel'} label="Taaktitel" required
        value={taak.titel} showPencil={false}
        displayClassName={`!text-2xl sm:!text-3xl font-semibold leading-tight tracking-tight ${isAfgerond?'text-muted-foreground line-through':'text-foreground'}`}
        onSave={titel=>updateTaak(taak.id,{titel})}/>
      <div className="flex flex-wrap items-center gap-2">
        {isAfgerond?
          <TaakStatusBadge status={taak.status}/>:
          <InlineDossierKeuze label="Status" showPencil={false} value={taak.status}
            options={[
              {value:'open',label:'Open'},
              {value:'in_uitvoering',label:'In uitvoering'},
              {value:'wacht_op_reactie',label:'Wachten op reactie'},
              {value:'geannuleerd',label:'Geannuleerd'},
            ]}
            onSave={status=>updateTaak(taak.id,{status:status as Taak['status']})}>
            <TaakStatusBadge status={taak.status}/>
          </InlineDossierKeuze>}
        <InlineDossierKeuze label="Prioriteit" showPencil={false} value={taak.prioriteit}
          options={[{value:'laag',label:'Laag'},{value:'normaal',label:'Normaal'},{value:'hoog',label:'Hoog'},{value:'urgent',label:'Urgent'}]}
          onSave={prioriteit=>updateTaak(taak.id,{prioriteit:prioriteit as Taak['prioriteit']})}>
          <PrioriteitBadge prioriteit={taak.prioriteit}/>
        </InlineDossierKeuze>
        <InlineDossierKeuze label="Taaktype" showPencil={false} value={taak.type}
          options={TAAK_TYPES.map(type=>({value:type,label:type}))}
          onSave={type=>updateTaak(taak.id,{type})}>
          <span className="inline-flex min-h-7 items-center rounded-full border border-border/70 px-3 text-xs text-muted-foreground">{taak.type}</span>
        </InlineDossierKeuze>
      </div>
      <div className="pt-1">
        {!isAfgerond?
          <Button type="button" className="min-h-11 w-full sm:w-auto sm:min-w-40"
            onClick={()=>setAfrondenOpen(true)}>
            <CheckCircle2 className="mr-2 h-4 w-4"/>Voltooien
          </Button>:
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto"
            onClick={()=>void heropen()}>
            <RotateCcw className="mr-2 h-4 w-4"/>Heropenen
          </Button>}
      </div>
    </section>

    <section className="rounded-2xl border border-border/75 bg-card/70 px-4 py-4 sm:px-6 sm:py-5">
      <TaakPlanningDetail task={taak} planning={planning} loading={planningLoading}
        loadError={planningError} refreshPlanning={async()=>{await loadPlanning();}}
        updateTask={patch=>updateTaak(taak.id,patch)}/>

      <div className="mt-5 border-t border-border/65 pt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Koppelingen</h2>
          <button type="button" disabled={linksLoading||Boolean(linksError)||savingLinks}
            onClick={openLinks}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-accent hover:bg-muted/40 disabled:opacity-50">
            {countTaskLinks(activeLinks)?'Wijzigen':'Toevoegen'}
            <Plus className="h-3.5 w-3.5"/>
          </button>
        </div>
        {linksLoading&&<p role="status" className="text-xs text-muted-foreground">Koppelingen laden…</p>}
        {linksError&&<div className="flex items-center gap-2">
          <p role="alert" className="text-xs text-destructive">{linksError}</p>
          <button type="button" onClick={()=>setLinksRefresh(v=>v+1)} className="text-xs text-accent underline">Opnieuw proberen</button>
        </div>}
        {!linksLoading&&!linksError&&
          <div className="divide-y divide-border/50">
            {(['relatie','object','deal','signaal'] as LinkKind[]).map(kind=>{
              const info=linksView[kind];
              return <div key={kind} className={rowClass}>
                <button type="button" onClick={openLinks}
                  aria-label={`${linkLabels[kind]} koppelen of wijzigen`}
                  className="group min-h-11 min-w-0 flex-1 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-center gap-3">
                    <span className="shrink-0 text-muted-foreground">{linkIcons[kind]}</span>
                    <span className="min-w-0">
                      {info.naam?
                        <span className="block truncate text-sm font-medium text-foreground">{info.naam}</span>:
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Plus className="h-3.5 w-3.5"/>{linkLabels[kind]} toevoegen
                        </span>}
                    </span>
                  </span>
                </button>
                {info.href&&info.naam&&
                  <Link to={info.href} aria-label={`${linkLabels[kind]} openen`}
                    className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ExternalLink className="h-4 w-4"/>
                  </Link>}
              </div>;
            })}
            {extraLinks>0&&<button type="button" onClick={openLinks}
              className="min-h-10 pt-2 text-left text-xs text-accent hover:underline">
              + {extraLinks} aanvullende {extraLinks===1?'koppeling':'koppelingen'} beheren
            </button>}
          </div>}
      </div>

      <div className="mt-5 border-t border-border/65 pt-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Notities</h2>
        <InlineDossierTekst key={taak.id+'-notities'} label="Taaknotities" value={taak.notities}
          showPencil={false} multiline emptyLabel="Notitie toevoegen…"
          onSave={notities=>updateTaak(taak.id,{notities})}/>
      </div>
    </section>

    <TaakFormDialog open={editOpen} onOpenChange={open=>{
      setEditOpen(open);
      if(!open){setPlanningRefresh(v=>v+1);setLinksRefresh(v=>v+1);}
    }} onSaved={()=>{
      setPlanningRefresh(v=>v+1);setLinksRefresh(v=>v+1);
    }} taak={taak}/>
    {linksOpen&&<TaskLinksPickerDialog open={linksOpen}
      onOpenChange={open=>{if(!savingLinks)setLinksOpen(open);}}
      value={linksDraft} onChange={setLinksDraft} onConfirm={next=>void saveLinks(next)}
      confirming={savingLinks} title="Koppelingen wijzigen"/>}
    <TaakAfrondenDialog open={afrondenOpen} onOpenChange={setAfrondenOpen}
      taak={afrondenOpen?taak:null}/>
    <AlertDialog open={verwijderOpen} onOpenChange={setVerwijderOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>Weet je zeker dat je deze taak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={()=>void verwijderen()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
