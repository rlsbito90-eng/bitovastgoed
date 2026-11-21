import type {ManualTaskPlanning} from '@/lib/tasks/reminders';
import {localDateKey} from '@/lib/tasks/workView';

type Choice = 'today' | 'tomorrow' | 'open' | 'later' | 'inbox';
type Props = {
  value: ManualTaskPlanning;
  onChange: (value: ManualTaskPlanning) => void;
  disabled?: boolean;
};

/** Werkdatum is een voornemen; een deadline blijft een apart, hard veld. */
export function workPlanForChoice(choice: Choice, now: Date = new Date()): ManualTaskPlanning {
  const day = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if (choice === 'today') return {planDatum:localDateKey(day),planTijd:null,planningBucket:'open'};
  if (choice === 'tomorrow') {
    day.setDate(day.getDate()+1);
    return {planDatum:localDateKey(day),planTijd:null,planningBucket:'open'};
  }
  return {
    planDatum:null,planTijd:null,
    planningBucket:choice === 'later'?'later':choice === 'inbox'?'inbox':'open',
  };
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
  return value.planningBucket==='later'?'later':value.planningBucket==='inbox'?'inbox':'open';
}

const OPTIONS:readonly {id:Choice,label:string}[]=[
  {id:'today',label:'Vandaag'},
  {id:'tomorrow',label:'Morgen'},
  {id:'open',label:'Openstaand'},
  {id:'later',label:'Later'},
  {id:'inbox',label:'Inbox'},
];

export default function TaakWerkplanningVelden({value,onChange,disabled=false}:Props){
  const selected=selectedWorkPlanChoice(value);
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Werkplanning
    </legend>
    <p className="text-xs text-muted-foreground">
      Wanneer wil je eraan werken? Dit is geen harde deadline. Geplande taken komen automatisch in je werklijst.
    </p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {OPTIONS.map(option=><button key={option.id} type="button"
        aria-pressed={selected===option.id}
        onClick={()=>onChange(workPlanForChoice(option.id))}
        className={`min-h-10 rounded-lg border px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected===option.id
          ?'border-accent/50 bg-accent/10 font-medium text-foreground'
          :'border-border/70 bg-background/30 text-muted-foreground hover:bg-muted/35 hover:text-foreground'}`}>
        {option.label}
      </button>)}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label htmlFor="taak-werkdatum" className="text-xs font-medium text-muted-foreground">Werkdatum</label>
        <input id="taak-werkdatum" type="date"
          value={value.planDatum??''}
          onChange={e=>onChange({
            planDatum:e.target.value||null,
            planTijd:e.target.value?value.planTijd??null:null,
            planningBucket:'open',
          })}
          className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"/>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="taak-werktijd" className="text-xs font-medium text-muted-foreground">Werktijd (optioneel)</label>
        <input id="taak-werktijd" type="time" disabled={!value.planDatum}
          value={value.planDatum?(value.planTijd??'').slice(0,5):''}
          onChange={e=>onChange({...value,planTijd:e.target.value||null})}
          className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40"/>
      </div>
    </div>
  </fieldset>;
}
