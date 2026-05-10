import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CAMPAGNE_KANAAL_LABEL, CAMPAGNE_STATUS_LABEL,
  type AcquisitieCampagne, type CampagneKanaal, type CampagneStatus,
} from '@/lib/acquisitie';
import { useAcquisitie } from '@/hooks/useAcquisitie';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campagne?: AcquisitieCampagne | null;
}

const leeg = {
  naam: '',
  kanaal: 'anders' as CampagneKanaal,
  gebied: '',
  startdatum: '',
  status: 'concept' as CampagneStatus,
  notities: '',
};

export default function AcquisitieCampagneFormDialog({ open, onOpenChange, campagne }: Props) {
  const { addCampagne, updateCampagne } = useAcquisitie();
  const [form, setForm] = useState(leeg);
  const [bezig, setBezig] = useState(false);
  const isEdit = !!campagne;

  useEffect(() => {
    if (campagne) {
      setForm({
        naam: campagne.naam,
        kanaal: campagne.kanaal,
        gebied: campagne.gebied ?? '',
        startdatum: campagne.startdatum ?? '',
        status: campagne.status,
        notities: campagne.notities ?? '',
      });
    } else {
      setForm(leeg);
    }
  }, [campagne, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    if (!form.naam.trim()) { toast.error('Geef de campagne een naam.'); return; }
    setBezig(true);
    try {
      if (isEdit && campagne) {
        await updateCampagne(campagne.id, { ...form });
        toast.success('Campagne bijgewerkt.');
      } else {
        await addCampagne({ ...form });
        toast.success('Campagne aangemaakt.');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Campagne bewerken' : 'Nieuwe campagne'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Campagnenaam *</Label>
            <Input value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kanaal</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.kanaal}
                onChange={(e) => setForm({ ...form, kanaal: e.target.value as CampagneKanaal })}>
                {Object.entries(CAMPAGNE_KANAAL_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as CampagneStatus })}>
                {Object.entries(CAMPAGNE_STATUS_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gebied</Label>
              <Input value={form.gebied} onChange={(e) => setForm({ ...form, gebied: e.target.value })} />
            </div>
            <div>
              <Label>Startdatum</Label>
              <Input type="date" value={form.startdatum} onChange={(e) => setForm({ ...form, startdatum: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notities</Label>
            <Textarea rows={3} value={form.notities} onChange={(e) => setForm({ ...form, notities: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Opslaan…' : isEdit ? 'Bijwerken' : 'Aanmaken'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
