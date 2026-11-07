import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { createManualTaskWithReminder } from '@/lib/tasks/reminders';
import { updateTaskPlanning } from '@/lib/tasks/planning';
import { localDateKey } from '@/lib/tasks/workView';
import type { AandachtItem } from '@/lib/dashboard/aandacht';
import { taakTitelVoor } from '@/components/dashboard/DashboardAandacht';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  item: AandachtItem | null;
  onOpenChange: (open: boolean) => void;
  /** Na opslaan: de nieuwe taak en haar plandatum, zodat het dashboard direct bijwerkt. */
  onGepland?: (taakId: string, planDatum: string) => void;
}

const plusDagen = (dagen: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dagen);
  return localDateKey(d);
};

/**
 * Opvolging plannen vanuit Aandacht nodig. Legt een plandatum vast (wanneer je eraan werkt);
 * een harde deadline alleen als de gebruiker die expliciet toevoegt.
 */
export default function OpvolgingPlannenDialog({ item, onOpenChange, onGepland }: Props) {
  const { refresh } = useDataStore();
  const [titel, setTitel] = useState('');
  const [planDatum, setPlanDatum] = useState(plusDagen(0));
  const [metDeadline, setMetDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTitel(taakTitelVoor(item));
    setPlanDatum(plusDagen(0));
    setMetDeadline(false);
    setDeadline('');
  }, [item]);

  const opslaan = async (event: React.FormEvent) => {
    event.preventDefault();
    const naam = titel.trim();
    if (!item || !naam || !planDatum || bezig) return;
    setBezig(true);
    try {
      const taakId = await createManualTaskWithReminder({
        titel: naam,
        objectId: item.objectId,
        type: 'Algemeen',
        deadline: metDeadline && deadline ? deadline : undefined,
        prioriteit: 'normaal',
        status: 'open',
        reminderSelection: 'default',
      });
      await updateTaskPlanning(taakId, { planDatum, planTijd: null, planningBucket: 'open' });
      onGepland?.(taakId, planDatum);
      await refresh();
      toast.success('Opvolging gepland');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Plannen mislukt: ${error?.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const keuze = (label: string, waarde: string) => (
    <Button type="button" size="sm" variant={planDatum === waarde ? 'default' : 'outline'} onClick={() => setPlanDatum(waarde)}>{label}</Button>
  );

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Opvolging plannen</DialogTitle>
          <DialogDescription>{item ? `Voor ${item.titel}. Plan wanneer je eraan werkt; een deadline alleen als er echt een uiterste datum is.` : ''}</DialogDescription>
        </DialogHeader>
        <form onSubmit={opslaan} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="opvolging-titel">Taak</Label>
            <Input id="opvolging-titel" value={titel} onChange={e => setTitel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opvolging-plandatum">Plandatum</Label>
            <div className="flex flex-wrap items-center gap-2">
              {keuze('Vandaag', plusDagen(0))}
              {keuze('Morgen', plusDagen(1))}
              <Input id="opvolging-plandatum" type="date" className="w-auto" value={planDatum} onChange={e => setPlanDatum(e.target.value)} />
            </div>
          </div>
          {metDeadline ? (
            <div className="space-y-1.5">
              <Label htmlFor="opvolging-deadline">Harde deadline</Label>
              <div className="flex items-center gap-2">
                <Input id="opvolging-deadline" type="date" className="w-auto" value={deadline} onChange={e => setDeadline(e.target.value)} />
                <Button type="button" size="sm" variant="ghost" onClick={() => { setMetDeadline(false); setDeadline(''); }}>Verwijderen</Button>
              </div>
            </div>
          ) : (
            <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => setMetDeadline(true)}>
              Harde deadline toevoegen
            </button>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={bezig || !titel.trim() || !planDatum}>{bezig ? 'Opslaan…' : 'Plannen'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
