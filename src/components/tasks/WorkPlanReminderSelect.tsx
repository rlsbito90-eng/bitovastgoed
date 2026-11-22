import {WORK_REMINDER_OFFSETS,type WorkReminderMode} from '@/lib/tasks/planning';
import {formatReminderOffset} from '@/lib/tasks/reminders';

interface Props {
  value: WorkReminderMode;
  onChange: (mode: WorkReminderMode) => void;
  hasDate: boolean;
  hasTime: boolean;
  disabled?: boolean;
}

/**
 * Eén werkherinnering, onafhankelijk van een harde deadline.
 * Datum zonder tijd kan dus nog steeds een melding om 09:00 krijgen.
 */
export default function WorkPlanReminderSelect({
  value,onChange,hasDate,hasTime,disabled=false,
}:Props){
  // Legacy taken zonder werktijd hebben feitelijk geen werkmelding.
  // Toon daarom Geen, zonder het bestaande record stilzwijgend te herschrijven.
  const needsTime=value==='at_time'||(value.startsWith('offset_')&&Number(value.slice(7))<1440);
  const selected=!hasDate||(needsTime&&!hasTime)?'none':value;
  return <div className="space-y-1.5">
    <label htmlFor="task-work-reminder" className="text-xs font-medium text-muted-foreground">
      Herinnering
    </label>
    <select id="task-work-reminder"
      value={selected}
      disabled={disabled||!hasDate}
      onChange={e=>onChange(e.target.value as WorkReminderMode)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50">
      <option value="none">Geen</option>
      <option value="on_day">Op de geplande dag om 09:00 uur</option>
      {value==='day_before'&&<option value="day_before">Een dag eerder om 09:00 uur</option>}
      {(hasTime||value==='at_time')&&
        <option value="at_time" disabled={!hasTime}>Op de gekozen tijd</option>}
      {WORK_REMINDER_OFFSETS.map(minutes=>{
        const needsTime=minutes<1440;
        if(needsTime&&!hasTime&&value!==`offset_${minutes}`)return null;
        return <option key={minutes} value={`offset_${minutes}`} disabled={needsTime&&!hasTime}>
          {formatReminderOffset(minutes)}{!hasTime&&minutes>=1440?' (09:00 uur)':''}
        </option>;
      })}
    </select>
  </div>;
}
