import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Landmark, Mail, MapPin, Save, Search, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OptionalDateField } from '@/components/forms/OptionalDateField';
import AcquisitieEigenaarWerkstroomKaart from '@/components/acquisitie/AcquisitieEigenaarWerkstroomKaart';
import { AcquisitieBrievenStatusKaart } from '@/components/acquisitie/AcquisitieBrievenStatusKaart';
import { AcquisitieKadasterStatusKaart } from '@/components/acquisitie/AcquisitieKadasterStatusKaart';
import VastgoedkansKadasterKaart from '@/components/acquisitie/VastgoedkansKadasterKaart';
import VastgoedkansOnderzoekWerkplek from '@/components/acquisitie/VastgoedkansOnderzoekWerkplek';
import { useVastgoedkansen, type KansInput } from '@/hooks/useVastgoedkansen';
import {
  BRIEF_LABEL, EIGENAAR_LABEL, KADASTER_LABEL, PRIORITEIT_LABEL, REACTIE_LABEL, STATUS_LABEL,
  type BriefStatus, type EigenaarOnderzoekStatus, type KadasterOnderzoekStatus, type ReactieStatus, type VastgoedkansStatus,
} from '@/lib/vastgoedkansen';
import {
  bewaarVastgoedkansWerkcontext, bepaalPrimaireWerkTab, bepaalWerkcontextNavigatie, bouwEigenaarGoogleUrl,
  type VastgoedkansWerkTab,
} from '@/lib/vastgoedkansWorkspace';
import { vastgoedkansNaarDossierContext } from '@/lib/acquisitieDossierAdapters';
import { vastgoedkansNaarBrievenReadModel } from '@/lib/acquisitieBrievenAdapters';
import { vastgoedkansNaarKadasterReadModel } from '@/lib/acquisitieKadasterAdapters';
import { bouwAcquisitieEigenaarWerkstroomModel } from '@/lib/acquisitieEigenaarWerkstroom';
import { bouwVastgoedkansOnderzoekModel } from '@/lib/vastgoedkansOnderzoek';
import { bouwVastgoedkansWorkflowReadModel } from '@/lib/workflow/vastgoedkansWorkflowReadModel';

const selectClass = 'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm';
const WORKFLOW_MODE_LABEL = { automatic: 'Automatisch afgeleid', proposal: 'Voorstel', confirmation: 'Bevestiging nodig' } as const;

export default function VastgoedkansDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { kansen, getKansById, laden, updateKans } = useVastgoedkansen();
  const kans = getKansById(id);
  const [form, setForm] = useState<KansInput>({});
  const [opslaan, setOpslaan] = useState(false);
  const [tab, setTab] = useState<VastgoedkansWerkTab>('overzicht');

  useEffect(() => {
    if (!kans) return;
    setForm({
      status: kans.status,
      eigenaarStatus: kans.eigenaarStatus, eigenaarNaam: kans.eigenaarNaam ?? '', eigenaarBron: kans.eigenaarBron ?? '', eigenaarLaatstGecontroleerdOp: kans.eigenaarLaatstGecontroleerdOp,
      kadasterStatus: kans.kadasterStatus, kadastraleAanduiding: kans.kadastraleAanduiding ?? '', kadasterLaatstGecontroleerdOp: kans.kadasterLaatstGecontroleerdOp,
      onderzoeksnotities: kans.onderzoeksnotities ?? '',
      briefStatus: kans.briefStatus, briefGeadresseerde: kans.briefGeadresseerde ?? '', briefVerzendwijze: kans.briefVerzendwijze ?? '', briefVerzondenOp: kans.briefVerzondenOp, briefKenmerk: kans.briefKenmerk ?? '',
      opvolgdatum: kans.opvolgdatum, opvolgactie: kans.opvolgactie ?? '', reactieStatus: kans.reactieStatus, reactieOntvangenOp: kans.reactieOntvangenOp, reactieKanaal: kans.reactieKanaal ?? '', reactieSamenvatting: kans.reactieSamenvatting ?? '', reactieUitkomst: kans.reactieUitkomst ?? '',
    });
    setTab(bepaalPrimaireWerkTab(kans));
  }, [kans]);

  const ids = useMemo(() => kansen.map((item) => item.id), [kansen]);
  const nav = useMemo(() => bepaalWerkcontextNavigatie(ids, id), [ids, id]);
  const dossierContext = useMemo(() => kans ? vastgoedkansNaarDossierContext(kans as any) : null, [kans]);
  const onderzoekModel = useMemo(() => kans ? bouwVastgoedkansOnderzoekModel(kans) : null, [kans]);
  const actueleBron = useMemo(
    () => kans ? { ...kans, ...form, adresControleGeslaagd: Boolean(kans.adres?.trim()) } : null,
    [kans, form],
  );
  const kadasterReadModel = useMemo(
    () => actueleBron ? vastgoedkansNaarKadasterReadModel(actueleBron as any) : null,
    [actueleBron],
  );
  const brievenReadModel = useMemo(
    () => actueleBron ? vastgoedkansNaarBrievenReadModel(actueleBron as any) : null,
    [actueleBron],
  );
  const workflowReadModel = useMemo(
    () => actueleBron ? bouwVastgoedkansWorkflowReadModel(actueleBron as any) : null,
    [actueleBron],
  );
  const eigenaarWerkstroom = useMemo(
    () => dossierContext ? bouwAcquisitieEigenaarWerkstroomModel({
      dossier: dossierContext,
      status: form.eigenaarStatus ?? kans?.eigenaarStatus,
      eigenaarNaam: form.eigenaarNaam ?? kans?.eigenaarNaam,
      eigenaarBron: form.eigenaarBron ?? kans?.eigenaarBron,
      kadastraleAanduiding: form.kadastraleAanduiding ?? kans?.kadastraleAanduiding,
      laatstGecontroleerdOp: form.eigenaarLaatstGecontroleerdOp ?? form.kadasterLaatstGecontroleerdOp ?? kans?.eigenaarLaatstGecontroleerdOp,
    }) : null,
    [dossierContext, form, kans],
  );

  useEffect(() => {
    if (!kans) return;
    bewaarVastgoedkansWerkcontext({ tab, kansId: kans.id, werkbak: kans.status, ids });
  }, [tab, kans, ids]);

  if (!kans) return <div className="page-shell"><Button variant="ghost" onClick={() => navigate('/vastgoedkansen')}><ArrowLeft className="mr-2 h-4 w-4" />Terug</Button><p className="mt-8 text-sm text-muted-foreground">{laden ? 'Vastgoedkans wordt geladen…' : 'Vastgoedkans niet gevonden.'}</p></div>;

  const adres = [kans.adres, kans.postcode, kans.plaats].filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
  const googleEigenaarUrl = bouwEigenaarGoogleUrl(form.eigenaarNaam ?? '', kans.plaats);

  const save = async () => {
    setOpslaan(true);
    try { await updateKans(kans.id, form); toast.success('Vastgoedkans opgeslagen.'); }
    catch (error: any) { toast.error(error.message ?? 'Opslaan mislukt.'); }
    finally { setOpslaan(false); }
  };

  const openKans = (targetId: string | null) => targetId && navigate(`/vastgoedkansen/${targetId}`);
  const setReactie = (value: ReactieStatus) => {
    setForm({ ...form, reactieStatus: value, briefStatus: value === 'geen_reactie' ? form.briefStatus : 'reactie_ontvangen' });
  };
  const scrollNaar = (targetId: string) => requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const openOnderzoek = () => scrollNaar('vastgoedkans-kadasteronderzoek');
  const openEigenaarZoeken = () => {
    if (googleEigenaarUrl) window.open(googleEigenaarUrl, '_blank', 'noopener,noreferrer');
    else scrollNaar('vastgoedkans-eigenaaronderzoek');
  };
  const openRelatieKoppelen = () => scrollNaar('vastgoedkans-relatiekoppeling');
  const openBriefVoorbereiden = () => setTab('brieven');

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <div className="mb-3 flex items-center justify-between gap-2">
      <Link to="/vastgoedkansen" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1.5 h-4 w-4" />Vastgoedkansen</Link>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={!nav.vorigeId} onClick={() => openKans(nav.vorigeId)}><ChevronLeft className="h-4 w-4" />Vorige</Button>
        <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">{nav.index >= 0 ? nav.index + 1 : '—'} / {nav.total}</span>
        <Button size="sm" variant="outline" disabled={!nav.volgendeId} onClick={() => openKans(nav.volgendeId)}>Volgende<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>

    <PageHeader title={kans.korteOmschrijving || adres || 'Vastgoedkans'} subtitle={[kans.kansnummer, adres].filter(Boolean).join(' · ')} actions={<Button onClick={save} disabled={opslaan}><Save className="mr-1.5 h-4 w-4" />{opslaan ? 'Opslaan…' : 'Opslaan'}</Button>} />

    <section className="section-card mb-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{STATUS_LABEL[(form.status ?? kans.status) as VastgoedkansStatus]}</Badge>
        <Badge variant="outline">{PRIORITEIT_LABEL[kans.prioriteit]}</Badge>
        {adres && <Button asChild size="sm" variant="outline"><a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin className="mr-1.5 h-4 w-4" />Kaart</a></Button>}
      </div>
    </section>

    <Tabs value={tab} onValueChange={(value) => setTab(value as VastgoedkansWerkTab)}>
      <TabsList className="mb-4 h-auto max-w-full justify-start overflow-x-auto bg-muted/50 p-1">
        <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
        <TabsTrigger value="onderzoek">Onderzoek</TabsTrigger>
        <TabsTrigger value="kadaster">Kadaster & eigenaar</TabsTrigger>
        <TabsTrigger value="brieven">Brieven & opvolging</TabsTrigger>
        <TabsTrigger value="dossier">Dossier</TabsTrigger>
      </TabsList>

      <TabsContent value="overzicht" className="space-y-4">
        <section className="section-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">Volgende actie</h2>
              <p className="mt-1 text-sm font-medium">{workflowReadModel?.nextAction?.label ?? 'Geen open workflowactie'}</p>
              {workflowReadModel?.nextAction?.dueAt && <p className="mt-1 text-xs text-muted-foreground">Uiterlijk {new Date(`${workflowReadModel.nextAction.dueAt}T12:00:00`).toLocaleDateString('nl-NL')}</p>}
            </div>
            {workflowReadModel?.nextAction && <Badge variant="outline">{WORKFLOW_MODE_LABEL[workflowReadModel.nextAction.mode]}</Badge>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">De workflow-engine leidt dit advies af uit de dossierfeiten. Commerciële statuswijzigingen en externe acties blijven expliciete gebruikersbeslissingen.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Kadaster</p><p className="mt-1 text-sm">{KADASTER_LABEL[(form.kadasterStatus ?? kans.kadasterStatus) as KadasterOnderzoekStatus]}</p></div><div><p className="text-xs text-muted-foreground">Eigenaar</p><p className="mt-1 text-sm">{EIGENAAR_LABEL[(form.eigenaarStatus ?? kans.eigenaarStatus) as EigenaarOnderzoekStatus]}</p></div><div><p className="text-xs text-muted-foreground">Brief</p><p className="mt-1 text-sm">{BRIEF_LABEL[(form.briefStatus ?? kans.briefStatus) as BriefStatus]}</p></div></div>
        </section>
        <section className="section-card p-4 sm:p-5"><h2 className="font-medium">Pand</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Adres</p><p className="mt-1 text-sm">{adres || 'Niet ingevuld'}</p></div><div><p className="text-xs text-muted-foreground">Type</p><p className="mt-1 text-sm">{kans.typeVastgoed || 'Niet ingevuld'}</p></div></div>{kans.redenInteressant && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{kans.redenInteressant}</p>}</section>
      </TabsContent>

      <TabsContent value="onderzoek" className="space-y-4">
        {onderzoekModel && <VastgoedkansOnderzoekWerkplek model={onderzoekModel} onOpenKadaster={() => setTab('kadaster')} />}
      </TabsContent>

      <TabsContent value="kadaster" className="space-y-4">
        {kadasterReadModel && <AcquisitieKadasterStatusKaart model={kadasterReadModel} />}
        {eigenaarWerkstroom && <AcquisitieEigenaarWerkstroomKaart model={eigenaarWerkstroom} onOpenOnderzoek={openOnderzoek} onOpenEigenaarZoeken={openEigenaarZoeken} onOpenRelatieKoppelen={openRelatieKoppelen} onOpenBriefVoorbereiden={openBriefVoorbereiden} />}
        <VastgoedkansKadasterKaart vastgoedkansId={kans.id} adres={kans.adres} postcode={kans.postcode} plaats={kans.plaats} />
        <section id="vastgoedkans-kadasteronderzoek" className="section-card scroll-mt-24 p-4 sm:p-5"><div className="flex items-center gap-2"><Landmark className="h-4 w-4" /><h2 className="font-medium">Kadasteronderzoek</h2></div><p className="mt-1 text-xs text-muted-foreground">Handmatige dossierregistratie; betaalde Kadastergegevens worden uitsluitend via de bevestigde kaart hierboven opgehaald en eigenaarvelden worden niet automatisch overgenomen.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Status</Label><select className={selectClass} value={form.kadasterStatus ?? 'niet_gestart'} onChange={(e) => setForm({ ...form, kadasterStatus: e.target.value as KadasterOnderzoekStatus })}>{Object.entries(KADASTER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><OptionalDateField label="Laatst gecontroleerd" value={form.kadasterLaatstGecontroleerdOp ?? ''} onChange={(value) => setForm({ ...form, kadasterLaatstGecontroleerdOp: value })} /><div className="sm:col-span-2"><Label>Kadastrale aanduiding</Label><Input value={form.kadastraleAanduiding ?? ''} onChange={(e) => setForm({ ...form, kadastraleAanduiding: e.target.value })} /></div></div></section>
        <section id="vastgoedkans-eigenaaronderzoek" className="section-card scroll-mt-24 p-4 sm:p-5"><div className="flex items-center gap-2"><UserSearch className="h-4 w-4" /><h2 className="font-medium">Eigenaar</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Status</Label><select className={selectClass} value={form.eigenaarStatus ?? 'niet_gestart'} onChange={(e) => setForm({ ...form, eigenaarStatus: e.target.value as EigenaarOnderzoekStatus })}>{Object.entries(EIGENAAR_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><OptionalDateField label="Laatst gecontroleerd" value={form.eigenaarLaatstGecontroleerdOp ?? ''} onChange={(value) => setForm({ ...form, eigenaarLaatstGecontroleerdOp: value })} /><div><Label>Eigenaar / rechthebbende</Label><Input value={form.eigenaarNaam ?? ''} onChange={(e) => setForm({ ...form, eigenaarNaam: e.target.value })} /></div><div><Label>Bron</Label><Input value={form.eigenaarBron ?? ''} onChange={(e) => setForm({ ...form, eigenaarBron: e.target.value })} /></div></div>{googleEigenaarUrl && <Button asChild className="mt-4" variant="outline"><a href={googleEigenaarUrl} target="_blank" rel="noreferrer"><Search className="mr-1.5 h-4 w-4" />Zoek naam op Google<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button>}</section>
      </TabsContent>

      <TabsContent value="brieven" className="space-y-4">
        {brievenReadModel && <AcquisitieBrievenStatusKaart model={brievenReadModel} />}
        <section className="section-card p-4 sm:p-5"><div className="flex items-center gap-2"><Mail className="h-4 w-4" /><h2 className="font-medium">Brief en verzending</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Briefstatus</Label><select className={selectClass} value={form.briefStatus ?? 'niet_gestart'} onChange={(e) => setForm({ ...form, briefStatus: e.target.value as BriefStatus, status: e.target.value === 'verzonden' ? 'opvolgen' : form.status })}>{Object.entries(BRIEF_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><Label>Geadresseerde</Label><Input value={form.briefGeadresseerde ?? ''} onChange={(e) => setForm({ ...form, briefGeadresseerde: e.target.value })} /></div><div><Label>Verzendwijze</Label><select className={selectClass} value={form.briefVerzendwijze ?? ''} onChange={(e) => setForm({ ...form, briefVerzendwijze: e.target.value })}><option value="">Niet gekozen</option><option value="post">Post</option><option value="handmatig_bezorgd">Handmatig bezorgd</option><option value="e-mail">E-mail</option><option value="anders">Anders</option></select></div><OptionalDateField label="Verzonden op" value={form.briefVerzondenOp ?? ''} onChange={(value) => setForm({ ...form, briefVerzondenOp: value, briefStatus: value ? 'verzonden' : form.briefStatus, status: value ? 'opvolgen' : form.status })} /><div className="sm:col-span-2"><Label>Briefkenmerk</Label><Input value={form.briefKenmerk ?? ''} onChange={(e) => setForm({ ...form, briefKenmerk: e.target.value })} /></div></div></section>
        <section className="section-card p-4 sm:p-5"><h2 className="font-medium">Opvolging en reactie</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><OptionalDateField label="Opvolgdatum" value={form.opvolgdatum ?? ''} onChange={(value) => setForm({ ...form, opvolgdatum: value, status: value ? 'opvolgen' : form.status })} /><div><Label>Opvolgactie</Label><Input value={form.opvolgactie ?? ''} onChange={(e) => setForm({ ...form, opvolgactie: e.target.value })} /></div><div><Label>Reactiestatus</Label><select className={selectClass} value={form.reactieStatus ?? 'geen_reactie'} onChange={(e) => setReactie(e.target.value as ReactieStatus)}>{Object.entries(REACTIE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><Label>Uitkomst</Label><Input value={form.reactieUitkomst ?? ''} onChange={(e) => setForm({ ...form, reactieUitkomst: e.target.value })} /></div></div></section>
      </TabsContent>

      <TabsContent value="dossier" className="space-y-4">
        <section className="section-card p-4 sm:p-5"><div className="flex items-center gap-2"><FileText className="h-4 w-4" /><h2 className="font-medium">Dossiernotities</h2></div><Textarea className="mt-4" rows={8} value={form.onderzoeksnotities ?? ''} onChange={(e) => setForm({ ...form, onderzoeksnotities: e.target.value })} /></section>
        <section className="section-card p-4 sm:p-5"><h2 className="font-medium">CRM-dossiercontext</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Bron</p><p className="mt-1 text-sm">Vastgoedkans · {dossierContext?.bronId}</p></div><div><p className="text-xs text-muted-foreground">Centraal Object-ID</p><p className="mt-1 break-all font-mono-data text-sm">{dossierContext?.objectId || 'Nog niet gekoppeld'}</p></div><div><p className="text-xs text-muted-foreground">BAG-pand-ID</p><p className="mt-1 break-all font-mono-data text-sm">{kans.bagPandId || 'Niet gekoppeld'}</p></div><div><p className="text-xs text-muted-foreground">BAG-verblijfsobject-ID</p><p className="mt-1 break-all font-mono-data text-sm">{kans.bagVerblijfsobjectId || 'Niet gekoppeld'}</p></div></div></section>
      </TabsContent>
    </Tabs>
  </div>;
}