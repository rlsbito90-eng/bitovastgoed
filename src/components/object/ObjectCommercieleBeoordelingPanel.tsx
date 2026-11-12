import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { ObjectVastgoed } from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AANBIED_ADVIES_LABELS,
  BESLISSER_LABELS,
  EERDER_AANGEBODEN_LABELS,
  INFORMATIE_LABELS,
  LEEG_BEOORDELING,
  PRIJS_FLEXIBILITEIT_LABELS,
  PRIJS_OORDEEL_LABELS,
  VERKOOP_BEREIDHEID_LABELS,
  VERKOOP_TERMIJN_LABELS,
  bepaalCommercieelAdvies,valideerCommercieleBeoordeling,
  type AanbiedAdvies,type BeslisserStatus,type EerderAangeboden,
  type InformatieStatus,type ObjectCommercieleBeoordeling,
  type PrijsFlexibiliteit,type PrijsOordeel,type VerkoopBereidheid,type VerkoopTermijn,
} from '@/lib/objecten/commercieleBeoordeling';
import {
  laadCommercieleBeoordeling,bewaarCommercieleBeoordeling,
} from '@/lib/objecten/commercieleBeoordelingApi';

type ObjectBron = Pick<ObjectVastgoed,
  'id'|'vraagprijs'|'prijsindicatie'|'marktwaardeIndicatie'|'marktwaardeBron'|'verkoopmotivatie'>;
interface Props {
  object:ObjectBron;
  onEditBrongegevens:(tab:'financieel'|'contacten')=>void;
}

const alsEuro=(v?:number|null)=>typeof v==='number'
  ?new Intl.NumberFormat('nl-NL',{
    style:'currency',currency:'EUR',maximumFractionDigits:0,
  }).format(v):'Niet ingevuld';

function Keuze<T extends string>({id,label,value,values,onChange}:{
  id:string;label:string;value:T;
  values:Record<T,string>;onChange:(next:T)=>void;
}){
  return <div className="space-y-1.5 min-w-0">
    <Label htmlFor={id}>{label}</Label>
    <select id={id} value={value} onChange={e=>onChange(e.target.value as T)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
      {Object.entries(values).map(([key,text])=>
        <option key={key} value={key}>{text as string}</option>)}
    </select>
  </div>;
}

/** Interne commerciële beoordeling vóór het selectief benaderen van kopers.
 * Ongewijzigde bronvelden blijven in Objecten; geen tweede waarderingsrecord.
 */
export default function ObjectCommercieleBeoordelingPanel({
  object,onEditBrongegevens,
}:Props){
  const [form,setForm]=useState<ObjectCommercieleBeoordeling>({
    objectId:object.id,...LEEG_BEOORDELING,
  });
  const [laden,setLaden]=useState(true);
  const [opslaan,setOpslaan]=useState(false);
  const [fout,setFout]=useState<string|null>(null);

  useEffect(()=>{
    let actief=true;
    setLaden(true);setFout(null);
    setForm({objectId:object.id,...LEEG_BEOORDELING});
    void laadCommercieleBeoordeling(object.id).then(result=>{
      if(!actief)return;
      setForm(result??{objectId:object.id,...LEEG_BEOORDELING});
    }).catch(e=>{
      if(!actief)return;
      setFout(e instanceof Error?e.message:'Commerciële beoordeling niet beschikbaar');
    }).finally(()=>{if(actief)setLaden(false);});
    return ()=>{actief=false;};
  },[object.id]);

  const set=<K extends keyof ObjectCommercieleBeoordeling>(
    key:K,value:ObjectCommercieleBeoordeling[K],
  )=>setForm(prev=>({...prev,[key]:value}));

  const advies=bepaalCommercieelAdvies(object,form);
  const {objectId:_,bijgewerktOp:__,...payload}=form;
  const validatie=valideerCommercieleBeoordeling(payload);
  const opslaanBeoordeling=async()=>{
    if(laden||opslaan||fout||validatie)return;
    setOpslaan(true);
    try{
      const saved=await bewaarCommercieleBeoordeling(form);
      setForm(saved);
      toast.success('Commerciële objectbeoordeling opgeslagen');
    }catch(e){
      toast.error(e instanceof Error?e.message:'Opslaan is niet gelukt');
    }finally{setOpslaan(false);}
  };

  return <div className="section-card p-5 sm:p-6 space-y-5"
    data-testid="commerciele-objectbeoordeling">
    <div className="flex flex-wrap justify-between gap-2 items-start">
      <div>
        <h3 className="section-title">Commerciële beoordeling</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Interne marktinschatting en verkoopbereidheid. Geen taxatie of
          automatische blokkade voor het benaderen van kopers.
        </p>
      </div>
      <span className="rounded-md border border-border px-2.5 py-1 text-sm font-medium">
        {AANBIED_ADVIES_LABELS[advies.gekozen]}
      </span>
    </div>

    <div className="grid sm:grid-cols-3 gap-3 rounded-md border border-border/70 p-3">
      <div className="text-sm">
        <span className="block text-xs text-muted-foreground">Vraagprijs</span>
        <strong>{alsEuro(object.vraagprijs)}</strong>
        {!object.vraagprijs&&object.prijsindicatie&&
          <p className="text-xs text-muted-foreground">{object.prijsindicatie}</p>}
      </div>
      <div className="text-sm">
        <span className="block text-xs text-muted-foreground">Eigen waarde-indicatie</span>
        <strong>{alsEuro(object.marktwaardeIndicatie)}</strong>
        {object.marktwaardeBron&&
          <p className="text-xs text-muted-foreground">{object.marktwaardeBron}</p>}
      </div>
      <div className="text-sm">
        <span className="block text-xs text-muted-foreground">Afwijking ten opzichte van indicatie</span>
        <strong>{advies.prijsverschilPct!==undefined
          ?(advies.prijsverschilPct>0?'+':'')+advies.prijsverschilPct.toFixed(1)+'%'
          :'Niet berekenbaar'}</strong>
        <p className="text-xs text-muted-foreground">Rekenkundig verschil, geen marktwaardeoordeel</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button size="sm" variant="outline" type="button"
        onClick={()=>onEditBrongegevens('financieel')}>
        <Pencil className="h-3.5 w-3.5 mr-1.5"/> Prijs en waardebron bewerken
      </Button>
      <Button size="sm" variant="outline" type="button"
        onClick={()=>onEditBrongegevens('contacten')}>
        <Pencil className="h-3.5 w-3.5 mr-1.5"/> Verkoopmotivatie bewerken
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      <strong>Huidige verkoopmotivatie:</strong>{' '}
      {object.verkoopmotivatie?.trim()||'Nog niet vastgelegd bij het object.'}
    </p>

    {fout&&<p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
      Opslag van de commerciële beoordeling is niet beschikbaar: {fout}.
      Controleer de aanvullende databasemigratie voordat je dit formulier gebruikt.
    </p>}

    <div className="grid sm:grid-cols-2 gap-4">
      <Keuze<PrijsOordeel> id="cb-prijs" label="Beoordeling vraagprijs"
        value={form.prijsOordeel} values={PRIJS_OORDEEL_LABELS}
        onChange={v=>set('prijsOordeel',v)}/>
      <Keuze<VerkoopBereidheid> id="cb-bereidheid" label="Verkoopbereidheid eigenaar"
        value={form.verkoopBereidheid} values={VERKOOP_BEREIDHEID_LABELS}
        onChange={v=>set('verkoopBereidheid',v)}/>
      <Keuze<VerkoopTermijn> id="cb-termijn" label="Gewenste verkooptermijn"
        value={form.verkoopTermijn} values={VERKOOP_TERMIJN_LABELS}
        onChange={v=>set('verkoopTermijn',v)}/>
      <Keuze<PrijsFlexibiliteit> id="cb-flexibiliteit" label="Prijsflexibiliteit"
        value={form.prijsFlexibiliteit} values={PRIJS_FLEXIBILITEIT_LABELS}
        onChange={v=>set('prijsFlexibiliteit',v)}/>
      <Keuze<BeslisserStatus> id="cb-beslisser" label="Beslissingsbevoegdheid"
        value={form.beslisserStatus} values={BESLISSER_LABELS}
        onChange={v=>set('beslisserStatus',v)}/>
      <Keuze<InformatieStatus> id="cb-documenten" label="Informatie voor markttoets"
        value={form.informatieStatus} values={INFORMATIE_LABELS}
        onChange={v=>set('informatieStatus',v)}/>
    </div>

    <div className="space-y-2">
      <Keuze<EerderAangeboden> id="cb-eerder" label="Eerder op de markt aangeboden?"
        value={form.eerderAangeboden} values={EERDER_AANGEBODEN_LABELS}
        onChange={v=>set('eerderAangeboden',v)}/>
      {form.eerderAangeboden==='ja'&&<div className="space-y-1.5">
        <Label htmlFor="cb-eerder-toelichting">Waar, wanneer en wat was de uitkomst?</Label>
        <Textarea id="cb-eerder-toelichting" rows={2} maxLength={2000}
          value={form.eerderAangebodenToelichting??''}
          onChange={e=>set('eerderAangebodenToelichting',e.target.value)}
          placeholder="Bijv. eerder via makelaar aangeboden; marktfeedback op prijs"/>
      </div>}
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="cb-intern-oordeel">Interne toelichting / aandachtspunten</Label>
      <Textarea id="cb-intern-oordeel" rows={2} maxLength={2000}
        value={form.internOordeel??''} onChange={e=>set('internOordeel',e.target.value)}
        placeholder="Wat moet eerst bij verkoper of in het dossier worden gecontroleerd?"/>
    </div>

    <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex gap-2 items-center">
        {advies.voorgesteld==='actief'?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:
          <AlertTriangle className="h-4 w-4 text-muted-foreground"/>}
        <p className="text-sm font-semibold">
          CRM-advies: {AANBIED_ADVIES_LABELS[advies.voorgesteld]}
        </p>
      </div>
      {advies.redenen.length>0&&<ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
        {advies.redenen.map((reden,i)=><li key={i}>{reden}</li>)}
      </ul>}
      {advies.informatieOntbreekt.length>0&&<div className="text-xs">
        <p className="font-medium">Nog te controleren</p>
        <ul className="list-disc pl-5 text-muted-foreground mt-1 space-y-1">
          {advies.informatieOntbreekt.map((v,i)=><li key={i}>{v}</li>)}
        </ul>
      </div>}
      <div className="space-y-1.5">
        <Label htmlFor="cb-besluit">Jouw besluit voor de aanpak</Label>
        <select id="cb-besluit" value={form.besluit??''}
          onChange={e=>{
            const next=e.target.value as AanbiedAdvies|'';
            setForm(prev=>({
              ...prev,besluit:next||undefined,
              besluitToelichting:next?prev.besluitToelichting:undefined,
            }));
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">CRM-advies volgen</option>
          {Object.entries(AANBIED_ADVIES_LABELS).map(([key,label])=>
            <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      {form.besluit&&<div className="space-y-1.5">
        <Label htmlFor="cb-besluit-uitleg">Onderbouwing handmatig besluit (verplicht)</Label>
        <Textarea id="cb-besluit-uitleg" rows={2} maxLength={2000}
          value={form.besluitToelichting??''}
          onChange={e=>set('besluitToelichting',e.target.value)}
          placeholder="Bijv. voorlopig alleen aan twee bewezen kopers toetsen"/>
      </div>}
      {advies.gekozen==='markttoets'&&<p className="text-xs text-muted-foreground">
        Advies: begin beperkt met circa twee à drie bewezen passende kopers.
        Breder benaderen blijft jouw beslissing.
      </p>}
      <p className="text-xs text-muted-foreground">
        Dit is interne besluitondersteuning. De keuze verandert geen objectstatus,
        verstuurt niets en creëert geen automatische kandidaat.
      </p>
    </div>
    {validatie&&<p className="text-xs text-destructive" role="alert">{validatie}</p>}
    <div className="flex justify-between items-center gap-3 flex-wrap">
      <p className="text-xs text-muted-foreground">
        {form.bijgewerktOp?'Laatst vastgelegd: '+new Intl.DateTimeFormat('nl-NL',{
          dateStyle:'medium',timeStyle:'short',
        }).format(new Date(form.bijgewerktOp)):'Nog geen beoordeling opgeslagen'}
      </p>
      <Button type="button" onClick={()=>void opslaanBeoordeling()}
        disabled={laden||opslaan||!!fout||!!validatie}>
        <Save className="h-4 w-4 mr-1.5"/>
        {opslaan?'Opslaan…':'Beoordeling opslaan'}
      </Button>
    </div>
  </div>;
}
