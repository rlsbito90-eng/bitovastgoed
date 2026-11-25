import { useRef, useState } from 'react';
import { useModalScrollContainment } from '@/hooks/useModalScrollContainment';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import { createManualTaskWithReminder } from '@/lib/tasks/reminders';
import { localDateKey } from '@/lib/tasks/workView';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BiedboekTraject } from '@/lib/biedingen/offerBook';
import { standaardOpvolgTitel } from '@/lib/biedingen/opvolging';

function plusDagen(dagen: number) {
  const datum = new Date();
  datum.setDate(datum.getDate() + dagen);
  return localDateKey(datum);
}

interface Props {
  traject: BiedboekTraject;
  relatieNaam: string;
  objectNaam: string;
  onOpenChange: (open: boolean) => void;
}

export default function BiedboekOpvolgingDialog({ traject, relatieNaam, objectNaam, onOpenChange }: Props) {
  const { refresh } = useDataStore();
  const [titel, setTitel] = useState(() => standaardOpvolgTitel(traject, relatieNaam, objectNaam));
  const [planDatum, setPlanDatum] = useState(() => plusDagen(1));
  const [toelichting, setToelichting] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const createdTask = useRef<string | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  useModalScrollContainment(scrollBodyRef, true);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!titel.trim() || !planDatum || saving) return;
    setSaving(true);
    try {
      if (!createdTask.current) {
        createdTask.current = await createManualTaskWithReminder({
          titel: titel.trim(),
          objectId: traject.objectId,
          // Een verkopersopvolging hoort niet onder de koper-relatie thuis.
          relatieId: traject.fase === 'wacht_op_koper' ? traject.relatieId : undefined,
          dealId: traject.laatste.dealId || undefined,
          type: 'Algemeen',
          status: 'open',
          prioriteit: 'normaal',
          notities: toelichting.trim() || undefined,
          reminderSelection: 'default',
        }, {
          planDatum,
          planTijd: null,
          planningBucket: 'open',
        });
        setSaved(true);
      }
      await refresh();
      toast.success('Opvolgtaak ingepland');
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(createdTask.current
        ? 'De taak is opgeslagen, maar het overzicht kon niet worden vernieuwd. Kies Opnieuw laden; er wordt geen tweede taak aangemaakt.'
        : error instanceof Error ? error.message : 'Opvolgtaak opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-md min-w-0 max-h-[92dvh] flex-col overflow-hidden overscroll-none gap-0 p-0">
        <DialogHeader className="shrink-0 touch-none border-b px-4 pb-3 pt-5">
          <DialogTitle>Opvolging plannen</DialogTitle>
          <DialogDescription>
            Maak een taak voor {objectNaam}. Bij kopersopvolging koppelen we ook {relatieNaam};
            bij verkopersopvolging blijft de taak op het object. Een plandatum is geen harde deadline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div ref={scrollBodyRef} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="biedopvolging-titel">Taak</Label>
            <Input id="biedopvolging-titel" value={titel} onChange={e => setTitel(e.target.value)} disabled={saved} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biedopvolging-plan">Wanneer opvolgen?</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={planDatum === plusDagen(0) ? 'default' : 'outline'}
                disabled={saved} onClick={() => setPlanDatum(plusDagen(0))}>Vandaag</Button>
              <Button type="button" size="sm" variant={planDatum === plusDagen(1) ? 'default' : 'outline'}
                disabled={saved} onClick={() => setPlanDatum(plusDagen(1))}>Morgen</Button>
              <Input id="biedopvolging-plan" type="date" className="min-w-0 max-w-full w-auto" value={planDatum}
                min={plusDagen(0)} disabled={saved} onChange={e => setPlanDatum(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biedopvolging-toelichting">Toelichting (optioneel)</Label>
            <Textarea id="biedopvolging-toelichting" rows={2} value={toelichting} disabled={saved}
              placeholder="Bijvoorbeeld: reactie op tegenvoorstel bespreken"
              onChange={e => setToelichting(e.target.value)} />
          </div>
          {saved && (
            <p className="text-xs text-muted-foreground">
              De taak is al opgeslagen. Je kunt veilig opnieuw laden zonder duplicaat.
            </p>
          )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-4 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={saving || !titel.trim() || !planDatum}>
              <CalendarDays className="h-4 w-4 mr-1" />
              {saving ? 'Bezig…' : saved ? 'Opnieuw laden' : 'Taak plannen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
