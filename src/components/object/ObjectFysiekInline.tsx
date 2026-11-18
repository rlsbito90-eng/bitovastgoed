import {useEffect,useRef,useState} from 'react';
import {Trash2} from 'lucide-react';
import EditableValueButton from '@/components/ui/editable-value-button';
import {toast} from 'sonner';
import type {ObjectVastgoed} from '@/data/mock-data';
import {NumberField} from '@/components/ui/number-field';
import type {GuardedObjectPatch} from '@/lib/dataIntegrity/objectPayload';
import {
  type OppervlakteVeld,OPPERVLAKTE_VELDEN,maakOppervlaktePatch,
  maakOppervlakteWisPatch,EIGENDOM_KEUZES,eigendomIsStandaard,
} from '@/lib/objecten/inlineFysiek';
import {
  AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,
  AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props={object:ObjectVastgoed;onSave:(patch:GuardedObjectPatch)=>Promise<void>};

function OppervlakteInline({
  veld,label,hulp,waarde,onSave,
}:{
  veld:OppervlakteVeld;label:string;hulp:string;waarde:number|undefined;
  onSave:Props['onSave'];
}){
  const [edit,setEdit]=useState(false);
  const [busy,setBusy]=useState(false);
  const [concept,setConcept]=useState<number|undefined>(waarde);
  const latest=useRef<number|undefined>(waarde);
  const cancelled=useRef(false);
  const [confirmWis,setConfirmWis]=useState(false);
  useEffect(()=>{if(!edit){latest.current=waarde;setConcept(waarde);}},[waarde,edit]);

  async function commit(){
    if(!edit||busy||cancelled.current)return;
    const next=latest.current;
    if(next===waarde){setEdit(false);return;}
    if(next===undefined){
      setEdit(false);
      toast.info('Kies Waarde wissen om een oppervlak te verwijderen.');
      return;
    }
    let patch:GuardedObjectPatch;
    try{patch=maakOppervlaktePatch(veld,next);}
    catch(e){toast.error(e instanceof Error?e.message:'Ongeldig oppervlak');return;}
    setBusy(true);setEdit(false);
    try{
      await onSave(patch);
      toast.success(`${label} opgeslagen`,{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave(waarde===undefined?maakOppervlakteWisPatch(veld):maakOppervlaktePatch(veld,waarde))
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){setEdit(true);toast.error(e instanceof Error?e.message:'Opslaan mislukt');}
    finally{setBusy(false);}
  }
  async function wis(){
    setConfirmWis(false);setBusy(true);
    try{
      await onSave(maakOppervlakteWisPatch(veld));
      toast.success(`${label} gewist`,{
        action:{label:'Ongedaan maken',onClick:()=>{
          if(waarde!==undefined)void onSave(maakOppervlaktePatch(veld,waarde))
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){toast.error(e instanceof Error?e.message:'Wissen mislukt');}
    finally{setBusy(false);}
  }

  return <div className="min-w-0 space-y-1.5">
    <div className="flex items-center justify-between gap-1.5">
      <label htmlFor={`inline-${veld}`} className="field-label" title={hulp}>{label}</label>
      {!edit&&waarde!==undefined&&<button type="button" disabled={busy}
        aria-label={`Wis ${label}`} title="Waarde wissen"
        onClick={()=>setConfirmWis(true)}
        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5"/>
      </button>}
    </div>
    {edit?<NumberField id={`inline-${veld}`} aria-label={label}
      autoFocus decimals={2} value={concept}
      onChange={next=>{latest.current=next;setConcept(next);}}
      onBlur={()=>{void commit();}}
      onKeyDown={e=>{
        if(e.key==='Escape'){
          e.preventDefault();cancelled.current=true;setEdit(false);latest.current=waarde;setConcept(waarde);
        }
        if(e.key==='Enter'){e.preventDefault();void commit();}
      }}
    />:<EditableValueButton label={label} disabled={busy}
      onClick={()=>{cancelled.current=false;latest.current=waarde;setConcept(waarde);setEdit(true);}}
      className="font-medium tabular-nums">
      {waarde===undefined?<span className="font-normal text-muted-foreground">—</span>
        :`${waarde.toLocaleString('nl-NL',{maximumFractionDigits:2})} m²`}
      {busy&&<span className="ml-2 text-xs font-normal text-muted-foreground">Opslaan…</span>}
    </EditableValueButton>}
    <AlertDialog open={confirmWis} onOpenChange={setConfirmWis}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label} wissen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alleen dit oppervlak wordt verwijderd. Andere oppervlaktematen en de
            eventuele oppervlakten per verdieping blijven ongewijzigd.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={()=>void wis()}>Waarde wissen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

export default function ObjectFysiekInline({object,onSave}:Props){
  const [busy,setBusy]=useState(false);
  const [vrij,setVrij]=useState(false);
  const [vrijeWaarde,setVrijeWaarde]=useState('');
  const [editNote,setEditNote]=useState(false);
  const [note,setNote]=useState(object.erfpachtinformatie??'');
  const noteRef=useRef(object.erfpachtinformatie??'');
  const cancelled=useRef(false);
  const huidige=object.eigendomssituatie??'';
  const afwijkend=!!huidige&&!eigendomIsStandaard(huidige);
  useEffect(()=>{
    if(!editNote){setNote(object.erfpachtinformatie??'');noteRef.current=object.erfpachtinformatie??'';}
  },[object.erfpachtinformatie,editNote]);

  async function bewaarEigendom(next:string){
    if(busy||next===huidige)return;
    setBusy(true);
    try{
      await onSave({eigendomssituatie:next});
      toast.success('Eigendomssituatie opgeslagen',{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave({eigendomssituatie:huidige}).catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
      setVrij(false);setVrijeWaarde('');
    }catch(e){toast.error(e instanceof Error?e.message:'Wijzigen mislukt');}
    finally{setBusy(false);}
  }
  async function bewaarNotitie(){
    if(!editNote||busy||cancelled.current)return;
    const next=noteRef.current.trim();
    setEditNote(false);
    if(next===(object.erfpachtinformatie??'').trim())return;
    setBusy(true);
    try{
      await onSave({erfpachtinformatie:next});
      toast.success('Juridische toelichting opgeslagen',{
        action:{label:'Ongedaan maken',onClick:()=>{
          void onSave({erfpachtinformatie:object.erfpachtinformatie??''})
            .catch(()=>toast.error('Herstellen mislukt'));
        }},
      });
    }catch(e){
      setEditNote(true);
      toast.error(e instanceof Error?e.message:'Opslaan mislukt');
    }finally{setBusy(false);}
  }
  return <section className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4"
    data-testid="object-fysiek-inline">
    <div className="space-y-1">
      <h3 className="section-title">Oppervlakten en eigendom</h3>
      <p className="text-xs text-muted-foreground">
        Iedere oppervlaktemaat blijft afzonderlijk vastgelegd; de algemene totaaloppervlakte
        is niet automatisch VVO, BVO of GBO.
      </p>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4">
      {OPPERVLAKTE_VELDEN.map(item=>
        <OppervlakteInline key={`${object.id}-${item.veld}`}
          {...item} waarde={object[item.veld]} onSave={onSave}/>)}
    </div>
    <div className="border-t border-border/60 pt-4 space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="inline-eigendom" className="field-label">Eigendomssituatie</label>
        <select id="inline-eigendom" aria-label="Eigendomssituatie"
          disabled={busy}
          value={vrij?'__anders__':afwijkend?'__legacy__':huidige}
          onChange={e=>{
            const next=e.target.value;
            if(next==='__anders__'){
              setVrijeWaarde(afwijkend?huidige:'');
              setVrij(true);
            }else if(next==='__legacy__')setVrij(false);
            else{setVrij(false);void bewaarEigendom(next);}
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">— Niet vastgelegd —</option>
          {EIGENDOM_KEUZES.map(e=><option key={e} value={e}>{e}</option>)}
          {afwijkend&&<option value="__legacy__">Bestaande omschrijving: {huidige}</option>}
          <option value="__anders__">Andere omschrijving invoeren…</option>
        </select>
        {vrij&&<input autoFocus aria-label="Andere eigendomssituatie"
          value={vrijeWaarde}
          onChange={e=>setVrijeWaarde(e.target.value)}
          onBlur={()=>{if(vrijeWaarde.trim())void bewaarEigendom(vrijeWaarde.trim());else setVrij(false);}}
          onKeyDown={e=>{
            if(e.key==='Escape'){setVrij(false);setVrijeWaarde('');}
            if(e.key==='Enter'){e.preventDefault();if(vrijeWaarde.trim())void bewaarEigendom(vrijeWaarde.trim());}
          }}
          placeholder="Omschrijf de juridische eigendomssituatie"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/>}
        {busy&&<p className="text-xs text-muted-foreground">Opslaan…</p>}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center gap-2">
          <span className="field-label">Erfpacht- / eigendomstoelichting</span>

        </div>
        {editNote?<textarea aria-label="Erfpacht- / eigendomstoelichting"
          autoFocus rows={2} value={note}
          onChange={e=>{setNote(e.target.value);noteRef.current=e.target.value;}}
          onBlur={()=>{void bewaarNotitie();}}
          onKeyDown={e=>{
            if(e.key==='Escape'){
              e.preventDefault();cancelled.current=true;setEditNote(false);
              setNote(object.erfpachtinformatie??'');noteRef.current=object.erfpachtinformatie??'';
            }
            if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void bewaarNotitie();}
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />:<EditableValueButton label="Erfpacht- / eigendomstoelichting" multiline
          onClick={()=>{cancelled.current=false;setEditNote(true);}} disabled={busy}>
          {object.erfpachtinformatie?.trim()||<span className="text-muted-foreground">Geen toelichting</span>}
        </EditableValueButton>}
      </div>
      <p className="text-xs text-muted-foreground">
        Deze gegevens zijn dossierinformatie; eigendom en rechten moeten juridisch of
        kadastraal worden geverifieerd.
      </p>
    </div>
  </section>;
}
