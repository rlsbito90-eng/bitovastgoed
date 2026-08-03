import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ClipboardCheck, ExternalLink, Mail, MapPin, MessageSquare, Save, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { OptionalDateField } from '@/components/forms/OptionalDateField';
import { useVastgoedkansen, type KansInput } from '@/hooks/useVastgoedkansen';
import { BRIEF_LABEL, EIGENAAR_LABEL, KADASTER_LABEL, PRIORITEIT_LABEL, REACTIE_LABEL, STATUS_LABEL, type BriefStatus, type EigenaarOnderzoekStatus, type KadasterOnderzoekStatus, type ReactieStatus, type VastgoedkansStatus } from '@/lib/vastgoedkansen';

const selectClass='h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm';

export default function VastgoedkansDetailPage(){
  const { id='' }=useParams();
  const navigate=useNavigate();
  const { getKansById, laden, updateKans }=useVastgoedkansen();
  const kans=getKansById(id);
  const [form,setForm]=useState<KansInput>({});
  const [opslaan,setOpslaan]=useState(false);

  useEffect(()=>{if(kans)setForm({
    status:kans.status,
    eigenaarStatus:kans.eigenaarStatus,eigenaarNaam:kans.eigenaarNaam??'',eigenaarBron:kans.eigenaarBron??'',eigenaarLaatstGecontroleerdOp:kans.eigenaarLaatstGecontroleerdOp,
    kadasterStatus:kans.kadasterStatus,kadastraleAanduiding:kans.kadastraleAanduiding??'',kadasterLaatstGecontroleerdOp:kans.kadasterLaatstGecontroleerdOp,
    onderzoeksnotities:kans.onderzoeksnotities??'',
    briefStatus:kans.briefStatus,briefGeadresseerde:kans.briefGeadresseerde??'',briefVerzendwijze:kans.briefVerzendwijze??'',briefVerzondenOp:kans.briefVerzondenOp,briefKenmerk:kans.briefKenmerk??'',
    opvolgdatum:kans.opvolgdatum,opvolgactie:kans.opvolgactie??'',reactieStatus:kans.reactieStatus,reactieOntvangenOp:kans.reactieOntvangenOp,reactieKanaal:kans.reactieKanaal??'',reactieSamenvatting:kans.reactieSamenvatting??'',reactieUitkomst:kans.reactieUitkomst??'',
  })},[kans]);

  if(!kans)return <div className="page-shell"><Button variant="ghost" onClick={()=>navigate('/vastgoedkansen')}><ArrowLeft className="mr-2 h-4 w-4"/>Terug</Button><p className="mt-8 text-sm text-muted-foreground">{laden?'Vastgoedkans wordt geladen…':'Vastgoedkans niet gevonden.'}</p></div>;

  const save=async()=>{setOpslaan(true);try{await updateKans(kans.id,form);toast.success('Vastgoedkans opgeslagen.')}catch(e:any){toast.error(e.message??'Opslaan mislukt.')}finally{setOpslaan(false)}};
  const adres=[kans.adres,kans.postcode,kans.plaats].filter(Boolean).join(', ');
  const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
  const setReactie=(value:ReactieStatus)=>{const status:VastgoedkansStatus=value==='interesse'?'positieve_reactie':value==='geen_interesse'?'afgevallen':value==='later_contact'?'wachten':value==='reactie_ontvangen'?'opvolgen':form.status??kans.status;setForm({...form,reactieStatus:value,status,briefStatus:value==='geen_reactie'?form.briefStatus:'reactie_ontvangen'});};

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <Link to="/vastgoedkansen" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1.5 h-4 w-4"/>Vastgoedkansen</Link>
    <PageHeader title={kans.korteOmschrijving||adres||'Vastgoedkans'} subtitle={[kans.kansnummer,adres].filter(Boolean).join(' · ')} actions={<Button onClick={save} disabled={opslaan}><Save className="mr-1.5 h-4 w-4"/>{opslaan?'Opslaan…':'Opslaan'}</Button>}/>

    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <section className="section-card min-w-0 p-4 sm:p-5"><div className="flex items-center gap-2"><Building2 className="h-4 w-4"/><h2 className="font-medium">Pand en aanleiding</h2></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Adres</p><p className="mt-1 break-words text-sm">{adres||'Niet ingevuld'}</p></div><div><p className="text-xs text-muted-foreground">Type vastgoed</p><p className="mt-1 text-sm">{kans.typeVastgoed||'Niet ingevuld'}</p></div><div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Waarom interessant?</p><p className="mt-1 whitespace-pre-wrap text-sm">{kans.redenInteressant||'Niet ingevuld'}</p></div></div>{adres&&<a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center text-sm text-primary hover:underline"><MapPin className="mr-1.5 h-4 w-4"/>Open in Google Maps<ExternalLink className="ml-1 h-3.5 w-3.5"/></a>}</section>

        <section className="section-card min-w-0 p-4 sm:p-5"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4"/><h2 className="font-medium">BAG-context</h2></div><p className="mt-1 text-xs text-muted-foreground">Alleen handmatig gecontroleerde identifiers.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>BAG-pand-ID</Label><Input value={form.bagPandId??''} onChange={e=>setForm({...form,bagPandId:e.target.value})}/></div><div><Label>BAG-verblijfsobject-ID</Label><Input value={form.bagVerblijfsobjectId??''} onChange={e=>setForm({...form,bagVerblijfsobjectId:e.target.value})}/></div></div></section>

        <section className="section-card min-w-0 p-4 sm:p-5"><div className="flex items-center gap-2"><UserSearch className="h-4 w-4"/><h2 className="font-medium">Eigenaaronderzoek</h2></div><p className="mt-1 text-xs text-muted-foreground">Leg alleen handmatig geverifieerde gegevens met bron vast.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Status</Label><select className={selectClass} value={form.eigenaarStatus??'niet_gestart'} onChange={e=>setForm({...form,eigenaarStatus:e.target.value as EigenaarOnderzoekStatus})}>{Object.entries(EIGENAAR_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><OptionalDateField label="Laatst gecontroleerd" value={form.eigenaarLaatstGecontroleerdOp??''} onChange={v=>setForm({...form,eigenaarLaatstGecontroleerdOp:v})}/><div><Label>Eigenaar / rechthebbende</Label><Input value={form.eigenaarNaam??''} onChange={e=>setForm({...form,eigenaarNaam:e.target.value})}/></div><div><Label>Bron</Label><Input value={form.eigenaarBron??''} onChange={e=>setForm({...form,eigenaarBron:e.target.value})}/></div></div></section>

        <section className="section-card min-w-0 p-4 sm:p-5"><h2 className="font-medium">Kadastrale context</h2><p className="mt-1 text-xs text-muted-foreground">Kadasteronderzoek blijft expliciet handmatig.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Status</Label><select className={selectClass} value={form.kadasterStatus??'niet_gestart'} onChange={e=>setForm({...form,kadasterStatus:e.target.value as KadasterOnderzoekStatus})}>{Object.entries(KADASTER_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><OptionalDateField label="Laatst gecontroleerd" value={form.kadasterLaatstGecontroleerdOp??''} onChange={v=>setForm({...form,kadasterLaatstGecontroleerdOp:v})}/><div className="sm:col-span-2"><Label>Kadastrale aanduiding</Label><Input value={form.kadastraleAanduiding??''} onChange={e=>setForm({...form,kadastraleAanduiding:e.target.value})}/></div></div></section>

        <section className="section-card min-w-0 p-4 sm:p-5"><div className="flex items-center gap-2"><Mail className="h-4 w-4"/><h2 className="font-medium">Brief en verzending</h2></div><p className="mt-1 text-xs text-muted-foreground">Registratie ondersteunt de mailingworkflow; het CRM verstuurt niets automatisch.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Briefstatus</Label><select className={selectClass} value={form.briefStatus??'niet_gestart'} onChange={e=>setForm({...form,briefStatus:e.target.value as BriefStatus,status:e.target.value==='verzonden'?'opvolgen':form.status})}>{Object.entries(BRIEF_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><div><Label>Geadresseerde</Label><Input value={form.briefGeadresseerde??''} onChange={e=>setForm({...form,briefGeadresseerde:e.target.value})} placeholder="Naam eigenaar of rechtspersoon"/></div><div><Label>Verzendwijze</Label><select className={selectClass} value={form.briefVerzendwijze??''} onChange={e=>setForm({...form,briefVerzendwijze:e.target.value})}><option value="">Niet gekozen</option><option value="post">Post</option><option value="handmatig_bezorgd">Handmatig bezorgd</option><option value="e-mail">E-mail</option><option value="anders">Anders</option></select></div><OptionalDateField label="Verzonden op" value={form.briefVerzondenOp??''} onChange={v=>setForm({...form,briefVerzondenOp:v,briefStatus:v?'verzonden':form.briefStatus,status:v?'opvolgen':form.status})}/><div className="sm:col-span-2"><Label>Briefkenmerk / notitie</Label><Input value={form.briefKenmerk??''} onChange={e=>setForm({...form,briefKenmerk:e.target.value})} placeholder="Bijv. versie, batch of documentreferentie"/></div></div></section>

        <section className="section-card min-w-0 p-4 sm:p-5"><h2 className="font-medium">Opvolging</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><OptionalDateField label="Opvolgdatum" value={form.opvolgdatum??''} onChange={v=>setForm({...form,opvolgdatum:v,status:v?'opvolgen':form.status})}/><div><Label>Opvolgactie</Label><Input value={form.opvolgactie??''} onChange={e=>setForm({...form,opvolgactie:e.target.value})} placeholder="Bijv. nabellen of tweede brief"/></div></div></section>

        <section className="section-card min-w-0 p-4 sm:p-5"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4"/><h2 className="font-medium">Reactie</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Reactiestatus</Label><select className={selectClass} value={form.reactieStatus??'geen_reactie'} onChange={e=>setReactie(e.target.value as ReactieStatus)}>{Object.entries(REACTIE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><OptionalDateField label="Ontvangen op" value={form.reactieOntvangenOp??''} onChange={v=>setForm({...form,reactieOntvangenOp:v,briefStatus:v?'reactie_ontvangen':form.briefStatus})}/><div><Label>Kanaal</Label><select className={selectClass} value={form.reactieKanaal??''} onChange={e=>setForm({...form,reactieKanaal:e.target.value})}><option value="">Niet gekozen</option><option value="telefoon">Telefoon</option><option value="e-mail">E-mail</option><option value="brief">Brief</option><option value="whatsapp">WhatsApp</option><option value="persoonlijk">Persoonlijk</option><option value="anders">Anders</option></select></div><div><Label>Uitkomst</Label><Input value={form.reactieUitkomst??''} onChange={e=>setForm({...form,reactieUitkomst:e.target.value})} placeholder="Bijv. afspraak, later bellen of geen interesse"/></div><div className="sm:col-span-2"><Label>Samenvatting reactie</Label><Textarea rows={4} value={form.reactieSamenvatting??''} onChange={e=>setForm({...form,reactieSamenvatting:e.target.value})}/></div></div></section>

        <section className="section-card min-w-0 p-4 sm:p-5"><Label>Onderzoeksnotities</Label><Textarea rows={6} value={form.onderzoeksnotities??''} onChange={e=>setForm({...form,onderzoeksnotities:e.target.value})}/></section>
      </div>

      <aside className="min-w-0 space-y-4"><section className="section-card p-4"><h2 className="text-sm font-medium">Dossierstatus</h2><div className="mt-3 flex flex-wrap gap-2"><Badge>{STATUS_LABEL[(form.status??kans.status) as VastgoedkansStatus]}</Badge><Badge variant="outline">{PRIORITEIT_LABEL[kans.prioriteit]}</Badge></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Brief</dt><dd className="mt-1">{BRIEF_LABEL[(form.briefStatus??kans.briefStatus) as BriefStatus]}</dd></div><div><dt className="text-xs text-muted-foreground">Opvolging</dt><dd className="mt-1">{form.opvolgactie||'Niet gepland'}{form.opvolgdatum?` · ${form.opvolgdatum}`:''}</dd></div><div><dt className="text-xs text-muted-foreground">Reactie</dt><dd className="mt-1">{REACTIE_LABEL[(form.reactieStatus??kans.reactieStatus) as ReactieStatus]}</dd></div></dl></section><section className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">Briefverzending, Kadasteronderzoek en promotie naar Object blijven bewuste handmatige acties.</section></aside>
    </div>
  </div>
}
