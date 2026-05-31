import { useEffect, useState } from 'react';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/ui/number-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ACQUISITIE_STATUS_LABEL, ACQUISITIE_STATUS_VOLGORDE,
  type AcquisitieTarget, type AcquisitieStatus, type EigenaarBekend,
} from '@/lib/acquisitie';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieDropdownLabel, sorteerRelatiesVoorDropdown } from '@/lib/relatieNaam';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target?: AcquisitieTarget | null;
  defaultCampagneId?: string;
}

const leeg = {
  adres: '',
  postcode: '',
  plaats: '',
  wijk: '',
  typeVastgoed: '',
  redenInteressant: '',
  bron: '',
  campagneId: '',
  eigenaarBekend: 'onbekend' as EigenaarBekend,
  eigenaarWoontOpAdres: 'onbekend' as EigenaarBekend,
  relatieId: '',
  status: 'target_gevonden' as AcquisitieStatus,
  prioriteit: 3,
  laatsteActieDatum: '',
  volgendeActieDatum: '',
  volgendeActieOmschrijving: '',
  notities: '',
};

export default function AcquisitieTargetFormDialog({ open, onOpenChange, target, defaultCampagneId }: Props) {
  const { addTarget, updateTarget, campagnes } = useAcquisitie();
  const { relaties, contactpersonen } = useDataStore();
  const [form, setForm] = useState(leeg);
  const [bezig, setBezig] = useState(false);
  const isEdit = !!target;

  useEffect(() => {
    if (target) {
      setForm({
        adres: target.adres ?? '',
        postcode: target.postcode ?? '',
        plaats: target.plaats ?? '',
        wijk: target.wijk ?? '',
        typeVastgoed: target.typeVastgoed ?? '',
        redenInteressant: target.redenInteressant ?? '',
        bron: target.bron ?? '',
        campagneId: target.campagneId ?? '',
        eigenaarBekend: target.eigenaarBekend,
        eigenaarWoontOpAdres: target.eigenaarWoontOpAdres,
        relatieId: target.relatieId ?? '',
        status: target.status,
        prioriteit: target.prioriteit,
        laatsteActieDatum: target.laatsteActieDatum ?? '',
        volgendeActieDatum: target.volgendeActieDatum ?? '',
        volgendeActieOmschrijving: target.volgendeActieOmschrijving ?? '',
        notities: target.notities ?? '',
      });
    } else {
      setForm({ ...leeg, campagneId: defaultCampagneId ?? '' });
    }
  }, [target, open, defaultCampagneId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    setBezig(true);
    try {
      const payload = { ...form, campagneId: form.campagneId || null, relatieId: form.relatieId || null };
      if (isEdit && target) {
        await updateTarget(target.id, payload);
        toast.success('Target bijgewerkt.');
      } else {
        await addTarget(payload);
        toast.success('Target aangemaakt.');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const sorted = sorteerRelatiesVoorDropdown(relaties ?? [], contactpersonen ?? []);
  const selectCls = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm";

  const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Acquisitie target bewerken' : 'Nieuwe acquisitie target'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><Label>Adres</Label><Input value={form.adres} onChange={e => setForm({ ...form, adres: e.target.value })} /></div>
            <div><Label>Postcode</Label><Input value={form.postcode} onChange={e => setForm({ ...form, postcode: e.target.value })} /></div>
            <div><Label>Plaats</Label><Input value={form.plaats} onChange={e => setForm({ ...form, plaats: e.target.value })} /></div>
            <div><Label>Wijk / buurt</Label><Input value={form.wijk} onChange={e => setForm({ ...form, wijk: e.target.value })} /></div>
            <div><Label>Type vastgoed</Label><Input value={form.typeVastgoed} onChange={e => setForm({ ...form, typeVastgoed: e.target.value })} placeholder="Woning, kantoor…" /></div>
          </div>
          <div>
            <Label>Reden interessant</Label>
            <Textarea rows={2} value={form.redenInteressant} onChange={e => setForm({ ...form, redenInteressant: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bron</Label><Input value={form.bron} onChange={e => setForm({ ...form, bron: e.target.value })} /></div>
            <div>
              <Label>Campagne</Label>
              <select className={selectCls} value={form.campagneId} onChange={e => setForm({ ...form, campagneId: e.target.value })}>
                <option value="">— Geen campagne —</option>
                {campagnes.map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Eigenaar bekend</Label>
              <select className={selectCls} value={form.eigenaarBekend} onChange={e => setForm({ ...form, eigenaarBekend: e.target.value as EigenaarBekend })}>
                <option value="onbekend">Onbekend</option><option value="ja">Ja</option><option value="nee">Nee</option>
              </select>
            </div>
            <div>
              <Label>Eigenaar woont op adres</Label>
              <select className={selectCls} value={form.eigenaarWoontOpAdres} onChange={e => setForm({ ...form, eigenaarWoontOpAdres: e.target.value as EigenaarBekend })}>
                <option value="onbekend">Onbekend</option><option value="ja">Ja</option><option value="nee">Nee</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Gekoppelde relatie</Label>
            <select className={selectCls} value={form.relatieId} onChange={e => setForm({ ...form, relatieId: e.target.value })}>
              <option value="">— Geen relatie —</option>
              {sorted.map(r => <option key={r.id} value={r.id}>{getRelatieDropdownLabel(r, contactpersonen)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <select className={selectCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as AcquisitieStatus })}>
                {ACQUISITIE_STATUS_VOLGORDE.map(s => <option key={s} value={s}>{ACQUISITIE_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <Label>Prioriteit (1-5)</Label>
              <Input type="number" min={1} max={5} value={form.prioriteit} onChange={e => setForm({ ...form, prioriteit: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Laatste actie</Label><Input type="date" value={form.laatsteActieDatum} onChange={e => setForm({ ...form, laatsteActieDatum: e.target.value })} /></div>
            <div><Label>Volgende actie (datum)</Label><Input type="date" value={form.volgendeActieDatum} onChange={e => setForm({ ...form, volgendeActieDatum: e.target.value })} /></div>
          </div>
          <div>
            <Label>Volgende actie (omschrijving)</Label>
            <Input value={form.volgendeActieOmschrijving} onChange={e => setForm({ ...form, volgendeActieOmschrijving: e.target.value })} />
          </div>
          <div>
            <Label>Notities</Label>
            <Textarea rows={3} value={form.notities} onChange={e => setForm({ ...form, notities: e.target.value })} />
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
