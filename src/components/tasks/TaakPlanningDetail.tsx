import {useEffect,useState} from 'react';
import {Bell,CalendarDays,Clock3,Flag,X,Check} from 'lucide-react';
import {toast} from 'sonner';
import type {Taak} from '@/data/mock-data';
import {updateTaskPlanning,type TaskPlanningMeta,type WorkReminderMode} from '@/lib/tasks/planning';
import {
  getTaskReminderSelection,reminderSelectionToDb,formatReminderOffset,
  TASK_REMINDER_OFFSETS,type TaskReminderSelection,
} from '@/lib/tasks/reminders';
import {supabase} from '@/integrations/supabase/client';
import {localDateKey} from '@/lib/tasks/workView';
import {isTaakTeLaat} from '@/lib/taakHelpers';

type EditField='datum'|'tijd'|'deadline'|null;
type Props={
  task:Taak;planning:TaskPlanningMeta|null;loading:boolean;
  loadError:string|null;
  refreshPlanning:()=>Promise<void>;
  updateTask:(patch:Partial<Taak>)=>Promise<void>;
};
const inputClass='h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground';
const actionClass='min-h-10 rounded-lg px-3 text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const rowClass='flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function taskPlanDateLabel(date:string|null|undefined,now=new Date()):string {
  if(!date)return 'Niet ingepland';
  const today=localDateKey(now);
  if(date===today)return 'Vandaag';
  const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  if(date===localDateKey(next))return 'Morgen';
  const d=new Date(date+'T12:00:00');
  return Number.isNaN(d.getTime())?date:d.toLocaleDateString('nl-NL',{
    day:'numeric',month:'short',...(d.getFullYear()!==now.getFullYear()?{year:'numeric'}:{}),
  });
}
export function taskReminderLabel(value:WorkReminderMode,hasTime:boolean):string {
  if(value==='on_day')return 'Op de dag zelf, 09:00';
  if(value==='day_before')return 'Een dag eerder, 09:00';
  if(value==='at_time'&&hasTime)return 'Op de gekozen tijd';
  return 'Geen';
}
export function taskDeadlineLabel(date:string|undefined, time:string|undefined):string{
  if(!date)return 'Toevoegen';
  const d=new Date(date+'T12:00:00');
  const label=Number.isNaN(d.getTime())?date:d.toLocaleDateString('nl-NL',{
    day:'numeric',month:'short',year:'numeric',
  });
  return time?`${label} · ${time.slice(0,5)}`:label;
}

export default function TaakPlanningDetail({
  task,planning,loading,loadError,refreshPlanning,updateTask,
}:Props){
  const [editing,setEditing]=useState<EditField>(null);
  const [draftDate,setDraftDate]=useState('');
  const [draftTime,setDraftTime]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [deadlineReminder,setDeadlineReminder]=useState<TaskReminderSelection>('default');
  const [deadlineReminderLoaded,setDeadlineReminderLoaded]=useState(false);
  const [deadlineReminderError,setDeadlineReminderError]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    setEditing(null);
    setDeadlineReminderLoaded(false);
    setDeadlineReminderError(null);
    void getTaskReminderSelection(task.id)
      .then(selection=>{if(active){setDeadlineReminder(selection);setDeadlineReminderLoaded(true);}})
      .catch(err=>{
        if(active){setDeadlineReminderError('Deadlineherinnering laden mislukt');console.error(err);}
      });
    return ()=>{active=false;};
  },[task.id]);

  const openEdit=(field:EditField)=>{
    if(!field||busy||loading||!planning||loadError)return;
    setDraftDate(field==='deadline'?(task.deadline||''):(planning.planDatum||''));
    setDraftTime(field==='deadline'?(task.deadlineTijd?.slice(0,5)||''):(planning.planTijd?.slice(0,5)||''));
    setError(null);setEditing(field);
  };
  async function saveEdit(){
    if(!editing||busy||!planning)return;
    setBusy(true);setError(null);
    try{
      if(editing==='datum'){
        await updateTaskPlanning(task.id,{
          planDatum:draftDate||null,
          planTijd:draftDate?planning.planTijd:null,
          planningBucket:'open',
          reminderMode:!draftDate?'none'
            :planning.reminderMode==='at_time'&&!planning.planTijd?'none':planning.reminderMode,
        });
        await refreshPlanning();
      }else if(editing==='tijd'){
        await updateTaskPlanning(task.id,{
          planTijd:draftTime||null,
          ...(planning.reminderMode==='at_time'&&!draftTime?{reminderMode:'none' as WorkReminderMode}:{}),
        });
        await refreshPlanning();
      }else{
        await updateTask({
          deadline:draftDate,
          deadlineTijd:draftDate?(draftTime||undefined):undefined,
        });
      }
      setEditing(null);
      toast.success('Planning opgeslagen');
    }catch(err){
      setError(err instanceof Error?err.message:'Opslaan mislukt');
    }finally{setBusy(false);}
  }
  async function changeReminder(mode:WorkReminderMode){
    if(!planning?.planDatum||busy||loading)return;
    setBusy(true);
    try{
      await updateTaskPlanning(task.id,{reminderMode:mode});
      await refreshPlanning();
      toast.success('Herinnering opgeslagen');
    }catch(e){toast.error(e instanceof Error?e.message:'Herinnering opslaan mislukt');}
    finally{setBusy(false);}
  }
  async function changeDeadlineReminder(selection:TaskReminderSelection){
    if(!task.deadline||busy||!deadlineReminderLoaded)return;
    setBusy(true);
    try{
      const {error:dbError}=await supabase.from('taken').update(reminderSelectionToDb(selection) as any).eq('id',task.id);
      if(dbError)throw dbError;
      setDeadlineReminder(selection);
      toast.success('Deadlineherinnering opgeslagen');
    }catch(e){toast.error(e instanceof Error?e.message:'Deadlineherinnering opslaan mislukt');}
    finally{setBusy(false);}
  }
  const editable=Boolean(planning&&!loading&&!loadError);
  const date=planning?.planDatum||null;
  const time=date&&planning?.planTijd?planning.planTijd.slice(0,5):null;
  const reminder=planning?.reminderMode||'none';
  const labelClass='inline-flex min-w-0 items-center gap-2.5 text-sm text-muted-foreground';
  const valueClass='min-w-0 shrink-0 text-right text-sm font-medium text-foreground';
  return <section aria-label="Planning" className="space-y-1">
    <h2 className="pb-1 text-sm font-semibold text-foreground">Planning</h2>
    {!editable&&<p role="status" className="py-2 text-xs text-muted-foreground">
      {loadError||'Planning laden…'}
    </p>}
    <button type="button" disabled={!editable||busy} onClick={()=>openEdit('datum')}
      className={rowClass} aria-label="Datum wijzigen">
      <span className={labelClass}><CalendarDays className="h-4 w-4"/>Datum</span>
      <span className={valueClass}>{taskPlanDateLabel(date)}</span>
    </button>
    {editing==='datum'&&<div className="space-y-3 rounded-xl bg-muted/25 p-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          {label:'Vandaag',value:localDateKey(new Date())},
          {label:'Morgen',value:localDateKey(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1))},
          {label:'Niet ingepland',value:''},
        ].map(item=><button key={item.label} type="button" onClick={()=>setDraftDate(item.value)}
          aria-pressed={draftDate===item.value}
          className={`min-h-10 rounded-lg border px-2 text-xs font-medium ${draftDate===item.value?'border-accent/60 bg-accent/10':'border-border bg-background/30'}`}>
          {item.label}
        </button>)}
      </div>
      <label className="block space-y-1.5 text-xs text-muted-foreground">Of kies een datum
        <input aria-label="Planningdatum" type="date" className={inputClass} value={draftDate} onChange={e=>setDraftDate(e.target.value)}/>
      </label>
      <EditActions busy={busy} error={error} onCancel={()=>setEditing(null)} onSave={()=>void saveEdit()}/>
    </div>}
    <button type="button" disabled={!editable||busy} onClick={()=>openEdit(date?'tijd':'datum')}
      className={rowClass} aria-label="Tijd wijzigen">
      <span className={labelClass}><Clock3 className="h-4 w-4"/>Tijd</span>
      <span className={valueClass}>{time||'Toevoegen'}</span>
    </button>
    {editing==='tijd'&&<div className="space-y-3 rounded-xl bg-muted/25 p-3">
      <label className="block space-y-1.5 text-xs text-muted-foreground">Tijd (optioneel)
        <input aria-label="Planningtijd" type="time" value={draftTime} onChange={e=>setDraftTime(e.target.value)} className={inputClass}/>
      </label>
      <EditActions busy={busy} error={error} onCancel={()=>setEditing(null)} onSave={()=>void saveEdit()}/>
    </div>}
    <div className="flex min-h-12 items-center justify-between gap-3 px-1 py-1.5">
      <label htmlFor="taak-detail-reminder" className={labelClass}>
        <Bell className="h-4 w-4"/>Herinnering
      </label>
      <select id="taak-detail-reminder" aria-label="Herinnering"
        disabled={!editable||!date||busy} value={!date||(reminder==='at_time'&&!time)?'none':reminder}
        onChange={e=>{void changeReminder(e.target.value as WorkReminderMode);}}
        className="h-10 max-w-[60%] min-w-0 rounded-lg border border-transparent bg-transparent px-1 text-right text-sm font-medium text-foreground focus-visible:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
        <option value="none">Geen</option>
        <option value="on_day">Op de dag zelf, 09:00</option>
        <option value="day_before">Een dag eerder, 09:00</option>
        {(time||reminder==='at_time')&&<option value="at_time" disabled={!time}>Op de gekozen tijd</option>}
      </select>
    </div>
    <div className="border-t border-border/60 pt-2">
      <button type="button" className={rowClass} onClick={()=>openEdit('deadline')}
        disabled={loading||busy||!planning||Boolean(loadError)} aria-label="Deadline wijzigen">
        <span className={labelClass}><Flag className={`h-4 w-4 ${task.deadline&&isTaakTeLaat(task,new Date())?'text-destructive':''}`}/>Deadline</span>
        <span className={`${valueClass} ${task.deadline&&isTaakTeLaat(task,new Date())?'text-destructive':''}`}>
          {taskDeadlineLabel(task.deadline,task.deadlineTijd)}
        </span>
      </button>
      {editing==='deadline'&&<div className="space-y-3 rounded-xl bg-muted/25 p-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-xs text-muted-foreground">Deadline
            <input aria-label="Deadline datum" type="date" value={draftDate} onChange={e=>{setDraftDate(e.target.value);if(!e.target.value)setDraftTime('');}} className={inputClass}/>
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Tijd (optioneel)
            <input aria-label="Deadline tijd" type="time" disabled={!draftDate} value={draftTime} onChange={e=>setDraftTime(e.target.value)} className={inputClass}/>
          </label>
        </div>
        {task.deadline&&<button type="button" onClick={()=>{setDraftDate('');setDraftTime('');}} className="text-xs text-muted-foreground underline underline-offset-2">Deadline verwijderen</button>}
        <EditActions busy={busy} error={error} onCancel={()=>setEditing(null)} onSave={()=>void saveEdit()}/>
      </div>}
    </div>
    {task.deadline&&<div className="flex min-h-11 items-center justify-between gap-3 px-1">
      <label htmlFor="taak-detail-deadline-reminder" className={labelClass}>
        <Bell className="h-4 w-4"/>Deadlineherinnering
      </label>
      <select id="taak-detail-deadline-reminder" value={deadlineReminder} disabled={!deadlineReminderLoaded||busy}
        onChange={e=>{void changeDeadlineReminder(e.target.value as TaskReminderSelection);}}
        className="h-10 max-w-[59%] min-w-0 rounded-lg border border-transparent bg-transparent px-1 text-right text-sm font-medium text-foreground disabled:opacity-60">
        <option value="default">Standaard</option>
        <option value="none">Geen</option>
        {task.deadlineTijd&&TASK_REMINDER_OFFSETS.map(minutes=><option key={minutes} value={String(minutes)}>{formatReminderOffset(minutes)}</option>)}
      </select>
      {deadlineReminderError&&<span className="sr-only" role="alert">{deadlineReminderError}</span>}
    </div>}
  </section>;
}
function EditActions({busy,error,onCancel,onSave}:{
  busy:boolean;error:string|null;onCancel:()=>void;onSave:()=>void;
}){
  return <div className="space-y-2">
    {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex justify-end gap-2">
      <button type="button" disabled={busy} className={actionClass} onClick={onCancel}><X className="mr-1 inline h-3.5 w-3.5"/>Annuleren</button>
      <button type="button" disabled={busy} className="min-h-10 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground disabled:opacity-60"
        onClick={onSave}><Check className="mr-1 inline h-3.5 w-3.5"/>{busy?'Opslaan…':'Opslaan'}</button>
    </div>
  </div>;
}
