import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/hooks/useDataStore';
import type { Taak, TaakPrioriteit, TaakStatus } from '@/data/mock-data';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRelatieDropdownLabel, sorteerRelatiesVoorDropdown } from '@/lib/relatieNaam';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taak?: Taak | null;
  defaultRelatieId?: string;
  defaultDealId?: string;
}

const emptyForm = {
  titel: '',
  relatieId: '',
  dealId: '',
  type: 'Opvolging',
  deadline: new Date().toISOString().split('T')[0],
  deadlineTijd: '',
  prioriteit: 'normaal' as TaakPrioriteit,
  status: 'open' as TaakStatus,
  notities: '',
};

export default function TaakFormDialog({ open, onOpenChange, taak, defaultRelatieId, defaultDealId }: Props) {
  const { addTaak, updateTaak, deleteTaak, relaties, deals, getObjectById, contactpersonen } = useDataStore();
  const [form, setForm] = useState(emptyForm);
  const [bezig, setBezig] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  const isEdit = !!taak;

  useEffect(() => {
    if (taak) {
      setForm({
        titel: taak.titel,
        relatieId: taak.relatieId || '',
        dealId: taak.dealId || '',
        type: taak.type,
        deadline: taak.deadline,
        deadlineTijd: taak.deadlineTijd ? taak.deadlineTijd.slice(0, 5) : '',
        prioriteit: taak.prioriteit,
        status: taak.status,
        notities: taak.notities || '',
      });
    } else {
      setForm({
        ...emptyForm,
        relatieId: defaultRelatieId || '',
        dealId: defaultDealId || '',
      });
    }
  }, [taak, open, defaultRelatieId, defaultDealId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    setBezig(true);

    const data: Omit<Taak, 'id'> = {
      titel: form.titel.trim() || 'Naamloze taak',
      relatieId: form.relatieId || undefined,
      dealId: form.dealId || undefined,
      type: form.type,
      deadline: form.deadline || '',
      deadlineTijd: form.deadlineTijd || undefined,
      prioriteit: form.prioriteit,
      status: form.status,
      notities: form.notities || undefined,
    };

    try {
      if (isEdit && taak) {
        await updateTaak(taak.id, data);
        toast.success('Taak bijgewerkt');
      } else {
        await addTaak(data);
        toast.success('Taak aangemaakt');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const handleDelete = async () => {
    if (!taak || bezig) return;
    setBezig(true);
    try {
      await deleteTaak(taak.id);
      toast.success('Taak verwijderd');
      setVerwijderOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Taak bewerken' : 'Nieuwe taak'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={form.titel} onChange={e => set('titel', e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type taak</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="Bellen">Bellen</option>
                <option value="Opvolging">Opvolging</option>
                <option value="Document">Document</option>
                <option value="Planning">Planning</option>
                <option value="Relatiebeheer">Relatiebeheer</option>
                <option value="Overig">Overig</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioriteit</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.prioriteit} onChange={e => set('prioriteit', e.target.value)}>
                <option value="laag">Laag</option>
                <option value="normaal">Normaal</option>
                <option value="hoog">Hoog</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Deadline (datum)</Label>
              <Input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tijd (optioneel)</Label>
              <Input type="time" value={form.deadlineTijd} onChange={e => set('deadlineTijd', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="open">Open</option>
                <option value="in_uitvoering">In uitvoering</option>
                <option value="afgerond">Afgerond</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Relatie</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.relatieId} onChange={e => set('relatieId', e.target.value)}>
                <option value="">Geen</option>
                {sorteerRelatiesVoorDropdown(relaties, contactpersonen).map(r => (
                  <option key={r.id} value={r.id}>{getRelatieDropdownLabel(r, contactpersonen)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Deal</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.dealId} onChange={e => set('dealId', e.target.value)}>
                <option value="">Geen</option>
                {deals.map(d => {
                  const obj = getObjectById(d.objectId);
                  return <option key={d.id} value={d.id}>{obj?.titel || d.id}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notities</Label>
            <Textarea value={form.notities} onChange={e => set('notities', e.target.value)} rows={3} />
          </div>
          <div className="flex justify-between items-center gap-2 pt-2">
            <div>
              {isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setVerwijderOpen(true)}
                  disabled={bezig}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Verwijderen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
              <Button type="submit" disabled={bezig}>{bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Aanmaken')}</Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <AlertDialog open={verwijderOpen} onOpenChange={setVerwijderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={bezig}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bezig ? 'Bezig…' : 'Verwijderen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
