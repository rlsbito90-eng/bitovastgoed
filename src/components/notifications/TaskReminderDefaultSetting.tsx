import { useEffect, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/notifications/repository';
import { TASK_REMINDER_OFFSETS, formatReminderOffset } from '@/lib/tasks/reminders';
import { toast } from 'sonner';

export default function TaskReminderDefaultSetting() {
  const [value, setValue] = useState<string>('60');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await getNotificationPreferences();
        if (!cancelled) setValue(prefs.task_default_reminder_minutes == null ? 'none' : String(prefs.task_default_reminder_minutes));
      } catch (error) {
        console.error('Standaard taakherinnering laden mislukt', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      await updateNotificationPreferences({
        task_default_reminder_minutes: next === 'none' ? null : Number(next),
      });
      toast.success(`Standaard taakherinnering: ${next === 'none' ? 'geen melding' : formatReminderOffset(Number(next))}.`);
    } catch (error: any) {
      setValue(previous);
      toast.error(error?.message ?? 'Standaard taakherinnering opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-3 py-2 border-b border-border/60 bg-muted/10 flex items-center gap-2">
      <Clock3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Taken standaard</span>
      <div className="ml-auto flex items-center gap-1.5">
        {(loading || saving) && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <select
          aria-label="Standaard taakherinnering"
          disabled={loading || saving}
          value={value}
          onChange={e => void change(e.target.value)}
          className="h-7 max-w-[190px] rounded border border-input bg-background px-2 text-[11px] text-foreground"
        >
          <option value="none">Geen</option>
          {TASK_REMINDER_OFFSETS.map(minutes => (
            <option key={minutes} value={String(minutes)}>{formatReminderOffset(minutes)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
