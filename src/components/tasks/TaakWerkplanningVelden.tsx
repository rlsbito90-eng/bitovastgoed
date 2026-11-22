import type {ManualTaskPlanning} from '@/lib/tasks/reminders';
import {reminderAfterTimeChange} from '@/lib/tasks/planning';
import {localDateKey} from '@/lib/tasks/workView';
import WorkPlanReminderSelect from './WorkPlanReminderSelect';

type Choice = 'today' | 'tomorrow' | 'none';
type Props = {
  value: ManualTaskPlanning;
  onChange: (value: ManualTaskPlanning) => void;
  disabled?: boolean;
  autoReminderOnTime?: boolean;
  onReminderTouched?: () => void;
};

/** Werkdatum is een voornemen; een deadline blijft een apart, hard veld. */
export function workPlanForChoice(choice: Choice, now: Date = new Date()): ManualTaskPlanning {
  const day = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if (choice === 'today') return {planDatum:localDateKey(day),planTijd:null,planningBucket:'open'};
  if (choice === 'tomorrow') {
    day.setDate(day.getDate()+1);
    return {planDatum:localDateKey(day),planTijd:null,planningBucket:'open'};
  }
  return {planDatum:null,planTijd:null,planningBucket:'open',reminderMode:'none'};
}

export function selectedWorkPlanChoice(value:ManualTaskPlanning, now: Date = new Date()):Choice|null {
  if (value.planDatum){
    const today=localDateKey(now);
    const day=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    day.setDate(day.getDate()+1);
    if (value.planDatum===today) return 'today';
    if (value.planDatum===localDateKey(day)) return 'tomorrow';
    return null;
  }
  // Historische Inbox/Later/Openstaand zijn zichtbaar als één nog-te-plannen groep.
  return 'none';
}

const OPTIONS:readonly {id:Choice,label:string}[]=[
  {id:'today',label:'Vandaag'},
  {id:'tomorrow',label:'Morgen'},
  {id:'none',label:'Niet ingepland'},
];

export default function TaakWerkplanningVelden({
  value,onChange,disabled=false,autoReminderOnTime=true,onReminderTouched,
}:Props){
  const selected=selectedWorkPlanChoice(value);
  return <fieldset disabled={disabled} className="min-w-0 max-w-full space-y-2">
    <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Planning
    </legend>
    <p className="sr-only">
      Kies wanneer je de taak wilt uitvoeren.
    </p>
    <div className="grid min-w-0 grid-cols-3 gap-2">
      {OPTIONS.map(option=><button key={option.id} type="button"
        aria-pressed={selected===option.id}
        onClick={()=>{
          const next=workPlanForChoice(option.id);
          onChange({...next,reminderMode:option.id==='none'?'none':value.reminderMode==='at_time'?'none':(value.reminderMode??'none')});
        }}
        className={`min-h-10 min-w-0 rounded-lg border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected===option.id
          ?'border-accent/50 bg-accent/10 font-medium text-foreground'
          :'border-border/70 bg-background/30 text-muted-foreground hover:bg-muted/35 hover:text-foreground'}`}>
        {option.label}
      </button>)}
    </div>
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="taak-werkdatum" className="text-xs font-medium text-muted-foreground">Datum</label>
        <input id="taak-werkdatum" type="date"
          value={value.planDatum??''}
          onChange={e=>onChange({
            ...value,
            planDatum:e.target.value||null,
            planTijd:e.target.value?value.planTijd??null:null,
            planningBucket:'open',
            reminderMode:e.target.value?(value.reminderMode??'none'):'none',
          })}
          className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm"/>
      </div>
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="taak-werktijd" className="text-xs font-medium text-muted-foreground">Tijd (optioneel)</label>
        <input id="taak-werktijd" type="time" disabled={!value.planDatum}
          value={value.planDatum?(value.planTijd??'').slice(0,5):''}
          onChange={e=>onChange({
            ...value,
            planTijd:e.target.value||null,
            reminderMode:reminderAfterTimeChange(value.reminderMode??'none',value.planTijd,e.target.value,
              !autoReminderOnTime),
          })}
          className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40"/>
      </div>
    </div>
    <WorkPlanReminderSelect value={value.reminderMode??'none'}
      hasDate={Boolean(value.planDatum)}
      hasTime={Boolean(value.planTijd)}
      onChange={reminderMode=>{onReminderTouched?.();onChange({...value,reminderMode});}} />
  </fieldset>;
}
