import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/hooks/useDataStore';
import type { Deal, DealFase } from '@/data/mock-data';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  defaultRelatieId?: string;
  defaultObjectId?: string;
}

const faseOptions: DealFase[] = ['lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing', 'afgerond', 'afgevallen'];

const emptyForm = {
  objectId: '',
  relatieId: '',
  fase: 'lead' as DealFase,
  interessegraad: '3',
  datumEersteContact: new Date().toISOString().split('T')[0],
  datumFollowUp: '',
  bezichtigingGepland: '',
  indicatiefBod: '',
  notities: '',
};

export default function DealFormDialog({ open, onOpenChange, deal, defaultRelatieId, defaultObjectId }: Props) {
  const { addDeal, updateDeal, relaties, objecten } = useDataStore();
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!deal;

  useEffect(() => {
    if (deal) {
      setForm({
        objectId: deal.objectId,
        relatieId: deal.relatieId,
        fase: deal.fase,
        interessegraad: deal.interessegraad.toString(),
        datumEersteContact: deal.datumEersteContact,
        datumFollowUp: deal.datumFollowUp || '',
        bezichtigingGepland: deal.bezichtigingGepland || '',
        indicatiefBod: deal.indicatiefBod?.toString() || '',
        notities: deal.notities || '',
      });
    } else {
      setForm({
        ...emptyForm,
        relatieId: defaultRelatieId || '',
        objectId: defaultObjectId || '',
      });
    }
  }, [deal, open, defaultRelatieId, defaultObjectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.objectId || !form.relatieId) {
      toast.error('Object en relatie zijn verplicht');
      return;
    }

    const data: Omit<Deal, 'id'> = {
      objectId: form.objectId,
      relatieId: form.relatieId,
      fase: form.fase,
      interessegraad: Number(form.interessegraad),
      datumEersteContact: form.datumEersteContact,
      datumFollowUp: form.datumFollowUp || undefined,
      bezichtigingGepland: form.bezichtigingGepland || undefined,
      indicatiefBod: form.indicatiefBod ? Number(form.indicatiefBod) : undefined,
      notities: form.notities || undefined,
    };

    if (isEdit && deal) {
      updateDeal(deal.id, data);
      toast.success('Deal bijgewerkt');
    } else {
      addDeal(data);
      toast.success('Deal aangemaakt');
    }
    onOpenChange(false);
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Deal bewerken' : 'Nieuwe deal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Object *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.objectId} onChange={e => set('objectId', e.target.value)}>
                <option value="">Selecteer object</option>
                {objecten.map(o => <option key={o.id} value={o.id}>{o.titel}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Relatie *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.relatieId} onChange={e => set('relatieId', e.target.value)}>
                <option value="">Selecteer relatie</option>
                {relaties.map(r => <option key={r.id} value={r.id}>{r.bedrijfsnaam}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Dealfase</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.fase} onChange={e => set('fase', e.target.value)}>
                {faseOptions.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Interessegraad (1-5)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.interessegraad} onChange={e => set('interessegraad', e.target.value)}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {'★'.repeat(n)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Datum eerste contact</Label>
              <Input type="date" value={form.datumEersteContact} onChange={e => set('datumEersteContact', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Datum follow-up</Label>
              <Input type="date" value={form.datumFollowUp} onChange={e => set('datumFollowUp', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bezichtiging gepland</Label>
              <Input type="date" value={form.bezichtigingGepland} onChange={e => set('bezichtigingGepland', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Indicatief bod (€)</Label>
              <Input type="number" value={form.indicatiefBod} onChange={e => set('indicatiefBod', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notities</Label>
            <Textarea value={form.notities} onChange={e => set('notities', e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit">{isEdit ? 'Opslaan' : 'Aanmaken'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
