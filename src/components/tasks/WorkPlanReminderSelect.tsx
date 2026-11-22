import type {WorkReminderMode} from '@/lib/tasks/planning';

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
  const selected=!hasDate||(value==='at_time'&&!hasTime)?'none':value;
  return <div className="space-y-1.5">
    <label htmlFor="task-work-reminder" className="text-sm font-medium text-foreground">
      Herinnering bij werkplanning
    </label>
    <select id="task-work-reminder"
      value={selected}
      disabled={disabled||!hasDate}
      onChange={e=>onChange(e.target.value as WorkReminderMode)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50">
      <option value="none">Geen</option>
      <option value="on_day">Op de werkdag om 09:00 uur</option>
      <option value="day_before">Een dag ervoor om 09:00 uur</option>
      {(hasTime||value==='at_time')&&
        <option value="at_time" disabled={!hasTime}>Op de gekozen werktijd</option>}
    </select>
  </div>;
}
