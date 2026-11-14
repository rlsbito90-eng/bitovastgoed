import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';
import type { ObjectVastgoed } from '@/data/mock-data';
import { supabase } from '@/integrations/supabase/client';
import { buildMapsUrl } from '@/lib/maps';
import { resolveObjectAdressen, kanAdresOpKaart } from '@/lib/objecten/adresModel';
import {
  laadObjectAdressen, bewaarObjectAdressen, valideerAdresConcept,
  type AdresConcept, type AdresRpcClient, type MultiAdresSnapshot,
} from '@/lib/objecten/multiAdresRepository';

interface Props { object: ObjectVastgoed }

/**
 * Pas activeren na een GEISOLEERDE test / geautoriseerde rollout van de tabellen
 * én RPC's. De env flag staat standaard UIT. Geen onbedoelde query of write.
 */
export default function ObjectAdressenEditor({ object }: Props) {
  const [snapshot,setSnapshot]=useState<MultiAdresSnapshot|null>(null);
  const [draft,setDraft]=useState<AdresConcept[]>([]);
  const [status,setStatus]=useState<'laden'|'gereed'|'opslaan'|'fout'>('laden');
  const [error,setError]=useState('');
  const client=supabase as unknown as AdresRpcClient;

  const load=async (cancelled?:()=>boolean) => {
    setStatus('laden');
    setError('');
    try {
      const current=await laadObjectAdressen(client,object.id);
      if (cancelled?.()) return;
      const addresses=current.adressen.length
        ? current.adressen
        : resolveObjectAdressen(object).adressen;
      setSnapshot(current);
      setDraft(addresses.map(a=>({
        id:a.id,adres:a.adres,postcode:a.postcode,plaats:a.plaats,
        provincie:a.provincie,isHoofdadres:a.isHoofdadres,
      })));
      setStatus('gereed');
    } catch(e) {
      if (cancelled?.()) return;
      setError(e instanceof Error?e.message:'Adresregister is nog niet beschikbaar.');
      setStatus('fout');
    }
  };
  useEffect(()=>{
    let cancelled=false;
    void load(()=>cancelled);
    return ()=>{cancelled=true;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[object.id]);

  const update=(id:string,key:'adres'|'postcode'|'plaats'|'provincie',value:string)=>{
    setDraft(prev=>prev.map(a=>a.id===id?{...a,[key]:value}:a));
  };
  const add=()=>setDraft(prev=>[...prev,{
    id:'draft:'+crypto.randomUUID(),adres:'',postcode:'',plaats:object.plaats??'',
    provincie:object.provincie??'',isHoofdadres:prev.length===0,
  }]);
  const save=async()=>{
    if (!snapshot || status!=='gereed') return;
    const validation=valideerAdresConcept(draft);
    if (validation){toast.error(validation);return;}
    setStatus('opslaan');
    try {
      const updated=await bewaarObjectAdressen(client,object.id,snapshot.etag,draft);
      setSnapshot(updated);
      setDraft(updated.adressen.map(a=>({
        id:a.id,adres:a.adres,postcode:a.postcode,plaats:a.plaats,
        provincie:a.provincie,isHoofdadres:a.isHoofdadres,
      })));
      setStatus('gereed');
      toast.success('Adressen opgeslagen');
    }catch(e){
      setError(e instanceof Error?e.message:'Opslaan mislukt.');
      setStatus('fout');
      toast.error(e instanceof Error?e.message:'Opslaan mislukt.');
    }
  };

  return (
    <section className="section-card p-4 sm:p-5 space-y-4" aria-label="Meerdere adressen">
      <div className="flex justify-between gap-3 items-start flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Adressen binnen dit object</h2>
          <p className="text-xs text-muted-foreground">
            Adres is niet automatisch een zelfstandige verhuureenheid of aparte verkooppropositie.
          </p>
        </div>
        <button type="button" onClick={()=>void load()} disabled={status==='laden'||status==='opslaan'}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs disabled:opacity-40">
          <RefreshCcw className="h-3.5 w-3.5"/> Opnieuw ophalen
        </button>
      </div>
      {status==='laden'&&<p className="text-xs text-muted-foreground">Adresregister laden…</p>}
      {status==='fout'&&<p role="alert" className="text-xs text-destructive">{error} Controleer of de database-uitrol is voltooid.</p>}
      {(status==='gereed'||status==='opslaan'||(status==='fout'&&snapshot))&&(
        <>
          {snapshot?.adressen.length===0&&object.adres&&(
            <p className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
              Het bestaande objectadres is als voorstel ingevuld. Het oorspronkelijke objectveld blijft
              ongewijzigd; pas na ‘Opslaan’ komt dit adres in het nieuwe adresregister.
            </p>
          )}
          {draft.map((a,i)=>{
            const url=kanAdresOpKaart(a)?buildMapsUrl({
              adres:a.adres,postcode:a.postcode,plaats:a.plaats,provincie:a.provincie,
            }):null;
            return <div key={a.id} className="rounded-lg border border-border/70 p-3 space-y-2">
              <div className="flex justify-between items-center gap-2">
                <p className="font-medium text-sm">Adres {i+1}</p>
                <button type="button" aria-label={`Verwijder adres ${i+1}`}
                  disabled={status==='opslaan'}
                  onClick={()=>setDraft(prev=>prev.filter(x=>x.id!==a.id))}
                  className="p-2 rounded-md hover:bg-muted disabled:opacity-40">
                  <Trash2 className="h-4 w-4 text-muted-foreground"/>
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {(['adres','postcode','plaats','provincie'] as const).map(k=>
                  <label key={k} className="text-xs space-y-1">
                    <span>{({adres:'Straat en huisnummer',postcode:'Postcode',plaats:'Plaats',provincie:'Provincie'} as const)[k]}</span>
                    <input aria-label={`Adres ${i+1} ${k}`} value={a[k]??''}
                      disabled={status==='opslaan'} onChange={e=>update(a.id,k,e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"/>
                  </label>)}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="multi-object-hoofdadres" checked={a.isHoofdadres}
                    disabled={status==='opslaan'}
                    onChange={()=>setDraft(prev=>prev.map(x=>({...x,isHoofdadres:x.id===a.id})))}/>
                  Hoofdadres
                </label>
                {url&&<a href={url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
                  <MapPin className="h-3.5 w-3.5"/> Open in Google Maps</a>}
              </div>
            </div>;
          })}
          <div className="flex justify-between gap-2 flex-wrap">
            <button type="button" onClick={add} disabled={status!=='gereed'}
              className="inline-flex gap-1.5 items-center px-3 py-2 rounded-md border border-border text-sm disabled:opacity-40">
              <Plus className="h-4 w-4"/> Adres toevoegen
            </button>
            <button type="button" onClick={()=>void save()} disabled={status!=='gereed'}
              className="inline-flex gap-1.5 items-center px-3 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-40">
              <Save className="h-4 w-4"/> {status==='opslaan'?'Opslaan…':'Adressen opslaan'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            De vraagprijs, huur, bestaande objectdetails en kandidaten blijven onveranderd.
            Verwijderen van een adres met actieve objectonderdelen wordt geblokkeerd.
          </p>
        </>
      )}
    </section>
  );
}
