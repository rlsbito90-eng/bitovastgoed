import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import {
  getMatchesForRelatieFromData,
  formatCurrency,
  formatDate,
  type Zoekprofiel,
  ASSET_CLASS_LABELS,
  REGIO_OPTIES,
  INVESTEERDER_SUBTYPE_LABELS,
  KAPITAAL_SITUATIE_LABELS,
  COMMUNICATIE_KANAAL_LABELS,
} from '@/data/mock-data';
import {
  LeadStatusBadge, MatchScoreBadge, PrioriteitBadge,
} from '@/components/StatusBadges';
import {
  ArrowLeft, Phone, Mail, Pencil, Trash2, Plus,
  ShieldCheck, Linkedin, Globe, MessageSquarePlus,
} from 'lucide-react';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import Timeline from '@/components/contactmoment/Timeline';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import ZoekprofielFormDialog from '@/components/forms/ZoekprofielFormDialog';
import InlinePartijprofiel from '@/components/relatie/InlinePartijprofiel';
import InlineRelatieSectie, { type InlineRelatieVeld } from '@/components/relatie/InlineRelatieSectie';
import ContactpersonenPanel from '@/components/relatie/ContactpersonenPanel';
import ZoekprofielDetails from '@/components/relatie/ZoekprofielDetails';
import { labelPartijprofiel } from '@/lib/relaties/partijprofiel';
import { ClassificatieRij } from '@/components/TaxonomieBadges';
import MatchUitleg from '@/components/MatchUitleg';
import RelatiePipelineSectie from '@/components/pipeline/RelatiePipelineSectie';
import OffMarketSignalenSectie from '@/components/offmarket/OffMarketSignalenSectie';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import RelatieNaamDisplay from '@/components/RelatieNaamDisplay';
import { getLaatsteContactDatum, getLaatsteActiviteitDatum, getVolgendeOpenTaak } from '@/lib/relatieContact';
import { isTaakTeLaat, deadlineLabel } from '@/lib/taakHelpers';
import { getRelatieNamen } from '@/lib/relatieNaam';
import ListNavigator from '@/components/ListNavigator';
import { getListNavigation } from '@/lib/listNavigation';
import TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';
import { getPreferredBidderStage, getTrajectoryStage, isConcreteTransactionPosition } from '@/lib/lifecycle/trajectory';

const DEALSTRUCTUUR_LABELS: Record<string, string> = {
  direct: 'Direct eigendom',
  jv: 'JV',
  fonds: 'Fonds',
  asset_deal: 'Asset deal',
  share_deal: 'Share deal',
};


const BEDRIJFSVELDEN: readonly InlineRelatieVeld[] = [
  {key:'bedrijfsnaam',label:'Bedrijfsnaam'},
  {key:'kvkNummer',label:'KVK-nummer'},
  {key:'website',label:'Website',kind:'url'},
  {key:'linkedinUrl',label:'LinkedIn',kind:'url'},
  {key:'telefoon',label:'Algemeen telefoonnummer (historisch)',
    note:'Persoonlijke nummers staan bij Contactpersonen.'},
  {key:'email',label:'Algemeen e-mailadres (historisch)',kind:'email'},
  {key:'bronRelatie',label:'Herkomst van de relatie'},
  {key:'leadStatus',label:'Leadstatus',kind:'select',options:[
    {value:'koud',label:'Koud'},{value:'lauw',label:'Lauw'},
    {value:'warm',label:'Warm'},{value:'actief',label:'Actief'}]},
];
const VESTIGINGSVELDEN: readonly InlineRelatieVeld[] = [
  {key:'vestigingsadres',label:'Straat en huisnummer'},
  {key:'vestigingspostcode',label:'Postcode'},
  {key:'vestigingsplaats',label:'Plaats'},
  {key:'vestigingsland',label:'Land'},
];
const INVESTERINGSVELDEN: readonly InlineRelatieVeld[] = [
  {key:'regio',label:'Algemene regio’s',kind:'multi',
    options:REGIO_OPTIES.map(value=>({value,label:value})),
    note:'Specifieke regio’s en gemeenten leg je vast bij Zoekprofielen.'},
  {key:'budgetMin',label:'Budget minimum (€)',kind:'number'},
  {key:'budgetMax',label:'Budget maximum (€)',kind:'number'},
  {key:'rendementseis',label:'Rendementseis (%)',kind:'number'},
  {key:'kapitaalsituatie',label:'Kapitaalsituatie',kind:'select',
    options:Object.entries(KAPITAAL_SITUATIE_LABELS).map(([value,label])=>({value,label}))},
  {key:'eigenVermogenPct',label:'Eigen vermogen (%)',kind:'number'},
  {key:'voorkeurDealstructuur',label:'Dealstructuur',kind:'multi',
    options:Object.entries(DEALSTRUCTUUR_LABELS).map(([value,label])=>({value,label}))},
];
const COMMUNICATIEVELDEN: readonly InlineRelatieVeld[] = [
  {key:'voorkeurKanaal',label:'Voorkeur kanaal',kind:'select',
    options:Object.entries(COMMUNICATIE_KANAAL_LABELS).map(([value,label])=>({value,label}))},
  {key:'voorkeurTaal',label:'Voorkeurstaal',kind:'select',
    options:[{value:'nl',label:'Nederlands'},{value:'en',label:'Engels'},
      {value:'de',label:'Duits'},{value:'fr',label:'Frans'}]},
  {key:'ndaGetekend',label:'NDA getekend',kind:'checkbox'},
  {key:'ndaDatum',label:'Datum ondertekening',kind:'date'},
  {key:'investeerderSubtype',label:'Historische investeerderscategorie/rechtsvorm',
    kind:'readonly',
    options:Object.entries(INVESTEERDER_SUBTYPE_LABELS).map(([value,label])=>({value,label}))},
];
const NOTITIEVELDEN: readonly InlineRelatieVeld[] = [
  {key:'aankoopcriteria',label:'Bestaande algemene aankoopcriteria',kind:'textarea',
   note:'Nieuwe concrete criteria leg je vast bij Zoekprofielen. Bestaande tekst blijft behouden.'},
  {key:'verkoopintentie',label:'Verkoopintentie',kind:'textarea'},
  {key:'volgendeActie',label:'Losse opvolgnotitie',note:'Taken met deadlines staan bij Taken.'},
  {key:'notities',label:'Interne notities',kind:'textarea'},
];

export default function RelatieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const relatie = store.getRelatieById(id!);
  const [editOpen, setEditOpen] = useState(false);
  const [zpOpen, setZpOpen] = useState(false);
  const [zpBewerken, setZpBewerken] = useState<Zoekprofiel | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const zoekprofielFormRef = useRef<HTMLDivElement | null>(null);
  useEffect(()=>{
    if(zpOpen && zoekprofielFormRef.current?.scrollIntoView){
      zoekprofielFormRef.current.scrollIntoView({behavior:'smooth',block:'start'});
    }
  },[zpOpen]);

  if (!relatie) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Relatie niet gevonden.</p>
        <Link to="/relaties" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar relaties</Link>
      </div>
    );
  }

  const contactpersonen = store.getContactpersonenVoorRelatie(relatie.id);
  const zoekprofielen = store.getZoekprofielenByRelatie(relatie.id);
  const allRelationDeals = store.getDealsByRelatie(relatie.id);
  const defaultPipeline = store.getDefaultObjectPipeline();
  const trajectoryStages = defaultPipeline ? store.getStagesVoorPipeline(defaultPipeline.id) : [];
  const preferredBidderStage = getPreferredBidderStage(trajectoryStages);
  const deals = allRelationDeals.filter(deal => {
    if (deal.fase === 'afgerond' || deal.fase === 'afgevallen') return true;
    const stage = getTrajectoryStage(store.getObjectById(deal.objectId), trajectoryStages);
    return isConcreteTransactionPosition(stage, preferredBidderStage);
  });
  const taken = store.getTakenByRelatie(relatie.id).filter(t => t.status !== 'afgerond' && t.status !== 'geannuleerd');
  const matches = getMatchesForRelatieFromData(relatie.id, store.zoekprofielen, store.objecten);
  const laatsteContactDatum = getLaatsteContactDatum(relatie.id, store.contactMoments);
  const laatsteActiviteitDatum = getLaatsteActiviteitDatum(relatie.id, store.contactMoments);
  const volgendeOpenTaak = getVolgendeOpenTaak(relatie.id, store.taken);

  const fallbackIds = [...store.relaties]
    .sort((a, b) => (a.bedrijfsnaam || a.contactpersoon || '').localeCompare(b.bedrijfsnaam || b.contactpersoon || '', 'nl'))
    .map(r => r.id);
  const navInfo = getListNavigation('relaties', relatie.id, fallbackIds);

  const handleDelete = async () => {
    try {
      await store.deleteRelatie(relatie.id);
      toast.success('Relatie verwijderd');
      navigate('/relaties');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };


  return (
    <div className="page-shell-detail">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/relaties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Relaties
        </Link>
        <ListNavigator
          info={navInfo}
          buildHref={(id) => `/relaties/${id}`}
          itemLabel="relatie"
        />
      </div>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap justify-end gap-2">
          {relatie.telefoon && (
            <a href={`tel:${relatie.telefoon}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Phone className="h-4 w-4" /> Bel
            </a>
          )}
          {relatie.email && (
            <a href={`mailto:${relatie.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Mail className="h-4 w-4" /> Mail
            </a>
          )}
          {relatie.website && (
            <a href={relatie.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Globe className="h-4 w-4" />
            </a>
          )}
          {relatie.linkedinUrl && (
            <a href={relatie.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Linkedin className="h-4 w-4" />
            </a>
          )}
          <button onClick={() => setLogOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <MessageSquarePlus className="h-4 w-4" /> Log contact
          </button>
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <Pencil className="h-4 w-4" /> Bewerken
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center justify-center px-2.5 py-2 text-sm border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-destructive" aria-label="Verwijderen">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Relatie verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>Weet je zeker dat je {getRelatieNamen(relatie, store.contactpersonen).primair} wilt verwijderen? De relatie wordt gearchiveerd en is later terug te halen via de database.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="min-w-0">
          <RelatieNaamDisplay relatie={relatie} variant="detail" />
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <LeadStatusBadge status={relatie.leadStatus} />
            {relatie.ndaGetekend && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" /> NDA getekend
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 capitalize break-words">
            {relatie.partijprofiel ? labelPartijprofiel(relatie.partijprofiel) : relatie.type}
            {relatie.kvkNummer && ` · KVK ${relatie.kvkNummer}`}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        {zpOpen && <div ref={zoekprofielFormRef} className="lg:col-span-3 min-w-0">
          <ZoekprofielFormDialog inline open={zpOpen}
            onOpenChange={next=>{setZpOpen(next);if(!next)setZpBewerken(null);}}
            defaultRelatieId={relatie.id} zoekprofiel={zpBewerken}/>
        </div>}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">
          <InlinePartijprofiel relatie={relatie}
            onSave={(wijziging)=>store.updateRelatie(relatie.id,wijziging)} />

          <section className="section-card p-5 sm:p-6 space-y-4">
            <h2 className="section-title">Contactpersonen ({contactpersonen.length})</h2>
            <ContactpersonenPanel relatieId={relatie.id}/>
          </section>
          <InlineRelatieSectie titel="Bedrijf en algemene contactgegevens" relatie={relatie}
            velden={BEDRIJFSVELDEN} onSave={(p)=>store.updateRelatie(relatie.id,p)}/>
          <InlineRelatieSectie titel="Vestigingsgegevens" relatie={relatie}
            velden={VESTIGINGSVELDEN} onSave={(p)=>store.updateRelatie(relatie.id,p)}/>
          <section className="section-card p-5 sm:p-6 space-y-3">
            <h2 className="section-title">Bestaande vastgoedvoorkeuren</h2>
            <ClassificatieRij propertyTypeIds={relatie.propertyTypeIds}
              fallbackAssetClasses={relatie.assetClasses}
              subtypeIds={relatie.propertySubtypeIds} dealTypeIds={relatie.dealTypeIds} mode="multi"/>
            <p className="text-xs text-muted-foreground">Deze oudere algemene criteria blijven zichtbaar voor Matching. Nieuwe concrete zoekrichtingen horen bij Zoekprofielen.</p>
          </section>
          <InlineRelatieSectie titel="Investering en financiering" relatie={relatie}
            velden={INVESTERINGSVELDEN} onSave={(p)=>store.updateRelatie(relatie.id,p)}/>
          <InlineRelatieSectie titel="Communicatie en NDA" relatie={relatie}
            velden={COMMUNICATIEVELDEN} onSave={(p)=>store.updateRelatie(relatie.id,p)}/>
          <InlineRelatieSectie titel="Aankoop, verkoop en notities" relatie={relatie}
            velden={NOTITIEVELDEN} onSave={(p)=>store.updateRelatie(relatie.id,p)}/>
          <section className="section-card p-5 sm:p-6 space-y-3">
            <h2 className="section-title">Activiteit en opvolging</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><p className="field-label">Laatste contact</p><p className="field-value">{laatsteContactDatum?formatDate(laatsteContactDatum):'—'}</p></div>
              <div><p className="field-label">Laatste activiteit</p><p className="field-value">{laatsteActiviteitDatum?formatDate(laatsteActiviteitDatum):'—'}</p></div>
              <div><p className="field-label">Volgende open taak</p><p className="field-value">{volgendeOpenTaak?`${formatDate(volgendeOpenTaak.deadline)} · ${volgendeOpenTaak.titel}`:'—'}</p></div>
              <div><p className="field-label">Aangemaakt op</p><p className="field-value">{relatie.createdAt?formatDate(relatie.createdAt.slice(0,10)):'—'}</p></div>
            </div>
          </section>

          {/* PIPELINE */}
          <RelatiePipelineSectie relatieId={relatie.id} />

          {/* OFF-MARKET SIGNALEN */}
          <OffMarketSignalenSectie relatieId={relatie.id} />

          {/* DEALS */}
          {deals.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Gekoppelde deals ({deals.length})</h2></header>
              <div className="divide-y divide-border/70">
                {deals.map(deal => {
                  const obj = store.getObjectById(deal.objectId);
                  return (
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{obj?.titel}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {obj?.plaats} · <span className="font-mono-data">{formatCurrency(obj?.vraagprijs)}</span>
                            {deal.commissieBedrag != null && ` · commissie ${formatCurrency(deal.commissieBedrag)}`}
                          </p>
                        </div>
                        <TrajectoryStageBadge objectId={deal.objectId} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* TAKEN */}
          {taken.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Open taken ({taken.length})</h2></header>
              <div className="divide-y divide-border/70">
                {taken.map(taak => (
                  <div key={taak.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{taak.titel}</p>
                      <p className={`text-xs mt-0.5 tabular-nums ${isTaakTeLaat(taak) ? 'text-destructive' : 'text-muted-foreground'}`}>{deadlineLabel(taak)}{isTaakTeLaat(taak) ? ' · te laat' : ''}</p>
                    </div>
                    <PrioriteitBadge prioriteit={taak.prioriteit} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4 lg:space-y-6 min-w-0">
          <section className="section-card">
            <header className="section-header">
              <h2 className="section-title">Zoekprofielen ({zoekprofielen.length})</h2>
              <button onClick={() => { setZpBewerken(null); setZpOpen(true); }}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80">
                <Plus className="h-3 w-3" /> Zoekprofiel toevoegen
              </button>
            </header>
            <div className="divide-y divide-border/70">
              {zoekprofielen.length === 0 && (
                <p className="px-5 py-6 text-xs text-muted-foreground">
                  Nog geen aanvullende zoekprofielen. De algemene aankoopcriteria van deze relatie blijven beschikbaar.
                  Voeg een profiel toe voor een specifieke zoekrichting.
                </p>
              )}
              {zoekprofielen.map(zp => (
                <div key={zp.id} className="px-5 py-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate flex-1">{zp.naam}</p>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {zp.status === 'actief' ? 'Actief' : zp.status === 'pauze' ? 'Pauze' : 'Gearchiveerd'} · P{zp.prioriteit}
                      </span>
                      <button type="button" aria-label={`Bewerk zoekprofiel ${zp.naam}`}
                        onClick={() => { setZpBewerken(zp); setZpOpen(true); }}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:text-accent hover:bg-muted/40"
                        title="Zoekprofiel bewerken">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <ZoekprofielDetails profiel={zp}/>
                </div>
              ))}
            </div>
          </section>

          {matches.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Matchende objecten ({matches.length})</h2></header>
              <div className="divide-y divide-border/70">
                {matches.slice(0, 5).map((m, i) => {
                  const obj = store.getObjectById(m.objectId);
                  return (
                    <details key={i} className="group">
                      <summary className="block px-5 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer list-none">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              to={`/objecten/${m.objectId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-foreground truncate hover:text-accent block"
                            >
                              {obj?.titel}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">
                              {obj?.plaats} · {m.redenen.slice(0, 2).join(' · ')}
                            </p>
                          </div>
                          <MatchScoreBadge score={m.score} />
                        </div>
                      </summary>
                      <div className="px-5 pb-4">
                        <MatchUitleg match={m} object={obj ?? undefined} compact />
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          )}

          <Timeline relatieId={relatie.id} />
        </div>
      </div>

      <RelatieFormDialog open={editOpen} onOpenChange={setEditOpen} relatie={relatie} />
      <ContactMomentFormDialog open={logOpen} onOpenChange={setLogOpen} defaultRelatieId={relatie.id} />
    </div>
  );
}
