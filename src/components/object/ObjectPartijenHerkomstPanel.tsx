import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import QuickCreateRelationDialog from '@/components/forms/QuickCreateRelationDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  OBJECT_PARTIJ_ROLLEN, AANLEVER_KANALEN,
  laadObjectPartijen, laadObjectAanleveringen,
  registreerObjectPartij, registreerAanlevermoment,
  verwijderObjectPartij, verwijderAanlevermoment,
  type ObjectPartij, type ObjectAanlevering,
  type ObjectPartijRol, type AanleverKanaal,
} from '@/lib/objecten/aanbodHerkomst';

interface Props {
  objectId: string;
  /** Historische bestaande koppeling, nooit stil omzetten naar juridische eigenaar. */
  legacyVerkooprelatieId?: string | null;
}
const datumLabel = (waarde: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(waarde)
    ? new Intl.DateTimeFormat('nl-NL', {day:'2-digit',month:'short',year:'numeric'})
      .format(new Date(waarde+'T12:00:00'))
    : waarde;

export default function ObjectPartijenHerkomstPanel({
  objectId,legacyVerkooprelatieId,
}: Props){
  const {relaties,contactpersonen}=useDataStore();
  const [partijen,setPartijen]=useState<ObjectPartij[]>([]);
  const [aanleveringen,setAanleveringen]=useState<ObjectAanlevering[]>([]);
  const [relatieId,setRelatieId]=useState('');
  const [rol,setRol]=useState<ObjectPartijRol>('verkoper');
  const [datum,setDatum]=useState('');
  const [kanaal,setKanaal]=useState<AanleverKanaal>('email');
  const [toelichting,setToelichting]=useState('');
  const [quickOpen,setQuickOpen]=useState(false);
  const [fout,setFout]=useState<string|null>(null);
  const [laden,setLaden]=useState(true);
  const [opslaan,setOpslaan]=useState(false);
  const [teVerwijderen,setTeVerwijderen]=useState<{id:string;soort:'partij'|'aanlevering'}|null>(null);

  const ververs=useCallback(async()=>{
    try{
      const [p,a]=await Promise.all([laadObjectPartijen(objectId),laadObjectAanleveringen(objectId)]);
      setPartijen(p);setAanleveringen(a);setFout(null);
    }catch(e){
      setFout(e instanceof Error?e.message:'Betrokken partijen konden niet worden geladen.');
    }finally{setLaden(false);}
  },[objectId]);
  useEffect(()=>{setLaden(true);void ververs();},[ververs]);

  const relatieItems=useMemo<EntityPickerItem[]>(()=>relaties.filter(r=>!r.softDeletedAt).map(r=>{
    const n=getRelatieNamen(r,contactpersonen);
    return {
      id:r.id,primair:n.primair,secundair:n.secundair,
      searchHaystack:[n.primair,n.secundair,r.bedrijfsnaam,r.contactpersoon]
        .filter(Boolean).join(' ').toLowerCase().normalize('NFKD')
        .replace(/[\u0300-\u036f]/g,''),
    };
  }),[relaties,contactpersonen]);
  const noem=(rid:string)=>{
    const r=relaties.find(item=>item.id===rid);
    return r?getRelatieNamen(r,contactpersonen).primair:'Relatie niet meer gevonden';
  };

  const voegRolToe=async()=>{
    if(!relatieId||opslaan)return;
    if(partijen.some(p=>p.relatieId===relatieId&&p.rol===rol)){
      toast.error('Deze partij is al in deze rol gekoppeld.');
      return;
    }
    setOpslaan(true);
    try{
      await registreerObjectPartij({objectId,relatieId,rol});
      toast.success('Betrokken partij gekoppeld');
      await ververs();
    }catch(e){toast.error(e instanceof Error?e.message:'Koppelen mislukt');}
    finally{setOpslaan(false);}
  };
  const voegAanleveringToe=async()=>{
    if(!relatieId||!datum||opslaan)return;
    const bestaand=aanleveringen.some(a=>a.relatieId===relatieId&&a.aangeleverdOp===datum&&a.kanaal===kanaal);
    if(bestaand){toast.error('Dit aanlevermoment is al vastgelegd. Controleer de bestaande historie.');return;}
    setOpslaan(true);
    try{
      await registreerAanlevermoment({
        objectId,relatieId,aangeleverdOp:datum,kanaal,toelichting,
      });
      setToelichting('');
      toast.success('Aanlevermoment opgeslagen');
      await ververs();
    }catch(e){toast.error(e instanceof Error?e.message:'Aanlevering registreren mislukt');}
    finally{setOpslaan(false);}
  };
  const verwijder=async()=>{
    if(!teVerwijderen||opslaan)return;
    setOpslaan(true);
    try{
      if(teVerwijderen.soort==='partij')await verwijderObjectPartij(teVerwijderen.id);
      else await verwijderAanlevermoment(teVerwijderen.id);
      toast.success('Registratie verwijderd');
      setTeVerwijderen(null);
      await ververs();
    }catch(e){toast.error(e instanceof Error?e.message:'Verwijderen mislukt');}
    finally{setOpslaan(false);}
  };

  return <section className="section-card p-5 space-y-4" data-testid="object-partijen-herkomst">
    <div>
      <h3 className="section-title">Betrokken partijen en herkomst</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Leg afzonderlijk vast wie eigenaar is, verkoopt of het object heeft aangebracht.
        Bewaar iedere werkelijke aanleverdatum als aparte gebeurtenis.
      </p>
    </div>

    {legacyVerkooprelatieId&&<div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
      <p className="text-muted-foreground">Bestaande primaire verkooprelatie (historische koppeling)</p>
      <Link className="font-medium underline" to={'/relaties/'+legacyVerkooprelatieId}>
        {noem(legacyVerkooprelatieId)}
      </Link>
      <p className="mt-1 text-muted-foreground">
        Niet automatisch als juridisch eigenaar aangemerkt.
      </p>
    </div>}

    {laden?<p className="text-sm text-muted-foreground">Historie laden…</p>
    :fout?<p role="alert" className="text-sm text-destructive">
      Herkomstregistraties niet beschikbaar: {fout}. Controleer of de nieuwe databasemigratie is uitgevoerd.
    </p>:<>
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Partijen ({partijen.length})</h4>
        {!partijen.length&&<p className="text-sm text-muted-foreground">Nog geen aanvullende rollen vastgelegd.</p>}
        {partijen.map(p=><div key={p.id}
          className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 py-2">
          <div className="text-sm min-w-0">
            <Link to={'/relaties/'+p.relatieId} className="font-medium underline">{noem(p.relatieId)}</Link>
            <span className="text-muted-foreground"> · {OBJECT_PARTIJ_ROLLEN[p.rol]}</span>
          </div>
          <button type="button" aria-label={'Verwijder rol '+OBJECT_PARTIJ_ROLLEN[p.rol]}
            onClick={()=>setTeVerwijderen({id:p.id,soort:'partij'})}
            className="text-muted-foreground hover:text-destructive" disabled={opslaan}>
            <Trash2 className="h-4 w-4"/>
          </button>
        </div>)}
      </div>

      <div className="space-y-3 rounded-md border border-border p-3">
        <EntityPicker label="Relatie" pickerTitle="Selecteer betrokken partij"
          searchPlaceholder="Zoek op naam of bedrijf…" emptyLabel="Kies relatie"
          value={relatieId} onChange={setRelatieId} items={relatieItems}/>
        <Button size="sm" variant="outline" type="button" onClick={()=>setQuickOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1"/> Nieuwe relatie
        </Button>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="object-partij-rol">Rol bij dit object</Label>
            <select id="object-partij-rol" value={rol} onChange={e=>setRol(e.target.value as ObjectPartijRol)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
              {Object.entries(OBJECT_PARTIJ_ROLLEN).map(([key,value])=>
                <option key={key} value={key}>{value}</option>)}
            </select>
          </div>
          <Button type="button" disabled={!relatieId||opslaan} onClick={()=>void voegRolToe()}>
            Rol koppelen
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm">Aanleverhistorie ({aanleveringen.length})</h4>
        {aanleveringen.length===0&&
          <p className="text-sm text-muted-foreground">Nog geen werkelijke aanlevermomenten geregistreerd.</p>}
        {aanleveringen.map(a=><div key={a.id}
          className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 py-2">
          <div className="text-sm">
            <p><strong>{datumLabel(a.aangeleverdOp)}</strong> · <Link className="underline"
              to={'/relaties/'+a.relatieId}>{noem(a.relatieId)}</Link></p>
            <p className="text-xs text-muted-foreground">
              {AANLEVER_KANALEN[a.kanaal]}{a.toelichting?' · '+a.toelichting:''}
            </p>
          </div>
          <button type="button" aria-label={'Verwijder aanlevermoment '+datumLabel(a.aangeleverdOp)}
            onClick={()=>setTeVerwijderen({id:a.id,soort:'aanlevering'})}
            className="text-muted-foreground hover:text-destructive" disabled={opslaan}>
            <Trash2 className="h-4 w-4"/>
          </button>
        </div>)}
      </div>

      <div className="space-y-3 rounded-md border border-border p-3">
        <h4 className="font-medium text-sm">Aanlevermoment vastleggen</h4>
        <p className="text-xs text-muted-foreground">
          Gebruik de hierboven gekozen relatie. De aanleverdatum is niet automatisch de
          registratiedatum van het object.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><Label htmlFor="aanlever-datum">Werkelijke datum</Label>
            <Input id="aanlever-datum" type="date" value={datum}
              onChange={e=>setDatum(e.target.value)}/></div>
          <div><Label htmlFor="aanlever-kanaal">Kanaal</Label>
            <select id="aanlever-kanaal" value={kanaal}
              onChange={e=>setKanaal(e.target.value as AanleverKanaal)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
              {Object.entries(AANLEVER_KANALEN).map(([key,value])=>
                <option key={key} value={key}>{value}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="aanlever-toelichting">Toelichting (optioneel)</Label>
          <Textarea id="aanlever-toelichting" rows={2} value={toelichting}
            onChange={e=>setToelichting(e.target.value)}
            placeholder="Bijv. verkoopaanvraag na telefoongesprek"/>
        </div>
        <Button type="button" onClick={()=>void voegAanleveringToe()}
          disabled={!relatieId||!datum||opslaan}>Aanlevermoment registreren</Button>
      </div>
    </>}

    <QuickCreateRelationDialog open={quickOpen} onOpenChange={setQuickOpen}
      context="verkoper" onCreated={r=>setRelatieId(r.id)}/>

    <AlertDialog open={!!teVerwijderen} onOpenChange={open=>{if(!open)setTeVerwijderen(null);}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Registratie verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dit verwijdert alleen deze rol of dit aanlevermoment; het object en de relatie blijven behouden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={opslaan}>Annuleren</AlertDialogCancel>
          <AlertDialogAction disabled={opslaan}
            onClick={e=>{e.preventDefault();void verwijder();}}>
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
