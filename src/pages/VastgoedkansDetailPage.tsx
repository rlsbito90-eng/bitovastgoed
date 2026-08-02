import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ClipboardCheck, ExternalLink, MapPin, Save, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { OptionalDateField } from '@/components/forms/OptionalDateField';
import { useVastgoedkansen, type KansInput } from '@/hooks/useVastgoedkansen';
import { EIGENAAR_LABEL, KADASTER_LABEL, PRIORITEIT_LABEL, STATUS_LABEL, type EigenaarOnderzoekStatus, type KadasterOnderzoekStatus } from '@/lib/vastgoedkansen';

const selectClass='h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm';

export default function VastgoedkansDetailPage(){
  const { id='' }=useParams();
  const navigate=useNavigate();
  const { getKansById, laden, updateKans }=useVastgoedkansen();
  const kans=getKansById(id);
  const [form,setForm]=useState<KansInput>({});
  const [opslaan,setOpslaan]=useState(false);

  useEffect(()=>{if(kans)setForm({
    eigenaarStatus:kans.eigenaarStatus,eigenaarNaam:kans.eigenaarNaam??'',eigenaarBron:kans.eigenaarBron??'',eigenaarLaatstGecontroleerdOp:kans.eigenaarLaatstGecontroleerdOp,
    kadasterStatus:kans.kadasterStatus,kadastraleAanduiding:kans.kadastraleAanduiding??'',kadasterLaatstGecontroleerdOp:kans.kadasterLaatstGecontroleerdOp,
    bagPandId:kans.bagPandId??'',bagVerblijfsobjectId:kans.bagVerblijfsobjectId??'',onderzoeksnotities:kans.onderzoeksnotities??'',
  })},[kans]);

  if(!kans)return <div className="page-shell"><Button variant="ghost" onClick={()=>navigate('/vastgoedkansen')}><ArrowLeft className="mr-2 h-4 w-4"/>Terug</Button><p className="mt-8 text-sm text-muted-foreground">{laden?'Vastgoedkans wordt geladen…':'Vastgoedkans niet gevonden.'}</p></div>;

  const save=async()=>{setOpslaan(true);try{await updateKans(kans.id,form);toast.success('Onderzoekscontext opgeslagen.')}catch(e:any){toast.error(e.message??'Opslaan mislukt.')}finally{setOpslaan(false)}};
  const adres=[kans.adres,kans.postcode,kans.plaats].filter(Boolean).join(', ');
  const mapsUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <Link to="/vastgoedkansen" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1.5 h-4 w-4"/>Vastgoedkansen</Link>
    <PageHeader title={kans.korteOmschrijving||adres||'Vastgoedkans'} subtitle={[kans.kansnummer,adres].filter(Boolean).join(' · ')} actions={<Button onClick={save} disabled={opslaan}><Save className="mr-1.5 h-4 w-4"/>{opslaan?'Opslaan…':'Opslaan'}</Button>}/>

    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <section className="section-card min-w-0 p-4 sm:p-5">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4"/><h2 className="font-medium">Pand en aanleiding</h2></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Adres</p><p className="mt-1 break-words text-sm">{adres||'Niet ingevuld'}</p></div>
            <div><p className="text-xs text-muted-foreground">Type vastgoed</p><p className="mt-1 text-sm">{kans.typeVastgoed||'Niet ingevuld'}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Waarom interessant?</p><p className="mt-1 whitespace-pre-wrap text-sm">{kans.redenInteressant||'Niet ingevuld'}</p></div>
          </div>
          {adres&&<a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center text-sm text-primary hover:underline"><MapPin className="mr-1.5 h-4 w-4"/>Open in Google Maps<ExternalLink className="ml-1 h-3.5 w-3.5"/></a>}
        </section>

        <section className="section-card min-w-0 p-4 sm:p-5">
          <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4"/><h2 className="font-medium">BAG-context</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Registratie van reeds gecontroleerde BAG-identifiers. Deze ronde voert nog geen automatische BAG-opvraag uit.</p>
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0"><Label>BAG-pand-ID</Label><Input className="min-w-0" value={form.bagPandId??''} onChange={e=>setForm({...form,bagPandId:e.target.value})}/></div>
            <div className="min-w-0"><Label>BAG-verblijfsobject-ID</Label><Input className="min-w-0" value={form.bagVerblijfsobjectId??''} onChange={e=>setForm({...form,bagVerblijfsobjectId:e.target.value})}/></div>
          </div>
        </section>

        <section className="section-card min-w-0 p-4 sm:p-5">
          <div className="flex items-center gap-2"><UserSearch className="h-4 w-4"/><h2 className="font-medium">Eigenaaronderzoek</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Leg alleen handmatig geverifieerde gegevens met bron vast.</p>
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <div><Label>Status</Label><select className={selectClass} value={form.eigenaarStatus??'niet_gestart'} onChange={e=>setForm({...form,eigenaarStatus:e.target.value as EigenaarOnderzoekStatus})}>{Object.entries(EIGENAAR_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            <div><OptionalDateField label="Laatst gecontroleerd" value={form.eigenaarLaatstGecontroleerdOp??''} onChange={v=>setForm({...form,eigenaarLaatstGecontroleerdOp:v})}/></div>
            <div><Label>Eigenaar / rechthebbende</Label><Input value={form.eigenaarNaam??''} onChange={e=>setForm({...form,eigenaarNaam:e.target.value})}/></div>
            <div><Label>Bron</Label><Input value={form.eigenaarBron??''} onChange={e=>setForm({...form,eigenaarBron:e.target.value})} placeholder="Bijv. Kadasterproduct en datum"/></div>
          </div>
        </section>

        <section className="section-card min-w-0 p-4 sm:p-5">
          <h2 className="font-medium">Kadastrale context</h2>
          <p className="mt-1 text-xs text-muted-foreground">Kadasteronderzoek blijft expliciet handmatig. Het CRM bestelt of raadpleegt niets automatisch.</p>
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <div><Label>Status</Label><select className={selectClass} value={form.kadasterStatus??'niet_gestart'} onChange={e=>setForm({...form,kadasterStatus:e.target.value as KadasterOnderzoekStatus})}>{Object.entries(KADASTER_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            <div><OptionalDateField label="Laatst gecontroleerd" value={form.kadasterLaatstGecontroleerdOp??''} onChange={v=>setForm({...form,kadasterLaatstGecontroleerdOp:v})}/></div>
            <div className="sm:col-span-2"><Label>Kadastrale aanduiding</Label><Input value={form.kadastraleAanduiding??''} onChange={e=>setForm({...form,kadastraleAanduiding:e.target.value})} placeholder="Gemeente, sectie en perceelnummer"/></div>
          </div>
        </section>

        <section className="section-card min-w-0 p-4 sm:p-5"><Label>Onderzoeksnotities</Label><Textarea rows={6} value={form.onderzoeksnotities??''} onChange={e=>setForm({...form,onderzoeksnotities:e.target.value})} placeholder="Bevindingen, controles en nog openstaande onderzoeksvragen…"/></section>
      </div>

      <aside className="min-w-0 space-y-4">
        <section className="section-card p-4"><h2 className="text-sm font-medium">Dossierstatus</h2><div className="mt-3 flex flex-wrap gap-2"><Badge>{STATUS_LABEL[kans.status]}</Badge><Badge variant="outline">{PRIORITEIT_LABEL[kans.prioriteit]}</Badge></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Volgende actie</dt><dd className="mt-1">{kans.volgendeActieOmschrijving||'Niet gepland'}{kans.volgendeActieDatum?` · ${kans.volgendeActieDatum}`:''}</dd></div><div><dt className="text-xs text-muted-foreground">Eigenaaronderzoek</dt><dd className="mt-1">{EIGENAAR_LABEL[kans.eigenaarStatus]}</dd></div><div><dt className="text-xs text-muted-foreground">Kadaster</dt><dd className="mt-1">{KADASTER_LABEL[kans.kadasterStatus]}</dd></div></dl></section>
        <section className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">Geen automatische Kadasteractie, briefverzending of promotie naar Object. Iedere vervolgstap blijft een bewuste gebruikershandeling.</section>
      </aside>
    </div>
  </div>
}
