import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/hooks/useDataStore';
import type { Relatie, LeadStatus, PartijType, AssetClass } from '@/data/mock-data';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatie?: Relatie | null;
}

const emptyForm = {
  bedrijfsnaam: '',
  contactpersoon: '',
  type: 'belegger' as PartijType,
  telefoon: '',
  email: '',
  regio: '',
  assetClasses: '' as string,
  budgetMin: '',
  budgetMax: '',
  aankoopcriteria: '',
  verkoopintentie: '',
  leadStatus: 'lauw' as LeadStatus,
  volgendeActie: '',
  notities: '',
};

export default function RelatieFormDialog({ open, onOpenChange, relatie }: Props) {
  const { addRelatie, updateRelatie } = useDataStore();
  const [form, setForm] = useState(emptyForm);
  const [bezig, setBezig] = useState(false);
  const isEdit = !!relatie;

  useEffect(() => {
    if (relatie) {
      setForm({
        bedrijfsnaam: relatie.bedrijfsnaam,
        contactpersoon: relatie.contactpersoon,
        type: relatie.type,
        telefoon: relatie.telefoon,
        email: relatie.email,
        regio: relatie.regio.join(', '),
        assetClasses: relatie.assetClasses.join(', '),
        budgetMin: relatie.budgetMin?.toString() || '',
        budgetMax: relatie.budgetMax?.toString() || '',
        aankoopcriteria: relatie.aankoopcriteria || '',
        verkoopintentie: relatie.verkoopintentie || '',
        leadStatus: relatie.leadStatus,
        volgendeActie: relatie.volgendeActie || '',
        notities: relatie.notities || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [relatie, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    setBezig(true);

    const data: Partial<Relatie> = {
      bedrijfsnaam: form.bedrijfsnaam.trim(),
      contactpersoon: form.contactpersoon.trim(),
      type: form.type,
      telefoon: form.telefoon.trim(),
      email: form.email.trim(),
      regio: form.regio.split(',').map(s => s.trim()).filter(Boolean),
      assetClasses: form.assetClasses.split(',').map(s => s.trim()).filter(Boolean) as AssetClass[],
      budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
      budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
      aankoopcriteria: form.aankoopcriteria || undefined,
      verkoopintentie: form.verkoopintentie || undefined,
      leadStatus: form.leadStatus,
      volgendeActie: form.volgendeActie || undefined,
      notities: form.notities || undefined,
    };

    try {
      if (isEdit && relatie) {
        await updateRelatie(relatie.id, data);
        toast.success('Relatie bijgewerkt');
      } else {
        await addRelatie({ ...data, laatsteContact: new Date().toISOString().split('T')[0] } as Omit<Relatie, 'id'>);
        toast.success('Relatie aangemaakt');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Relatie bewerken' : 'Nieuwe relatie'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bedrijfsnaam</Label>
              <Input value={form.bedrijfsnaam} onChange={e => set('bedrijfsnaam', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contactpersoon</Label>
              <Input value={form.contactpersoon} onChange={e => set('contactpersoon', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type partij</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="belegger">Belegger</option>
                <option value="ontwikkelaar">Ontwikkelaar</option>
                <option value="eigenaar">Eigenaar</option>
                <option value="makelaar">Makelaar</option>
                <option value="partner">Partner</option>
                <option value="overig">Overig</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Leadstatus</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.leadStatus} onChange={e => set('leadStatus', e.target.value)}>
                <option value="koud">Koud</option>
                <option value="lauw">Lauw</option>
                <option value="warm">Warm</option>
                <option value="actief">Actief</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Telefoon</Label>
              <Input value={form.telefoon} onChange={e => set('telefoon', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Regio (kommagescheiden)</Label>
              <Input value={form.regio} onChange={e => set('regio', e.target.value)} placeholder="Randstad, Brabant" />
            </div>
            <div className="space-y-1.5">
              <Label>Asset classes (kommagescheiden)</Label>
              <Input value={form.assetClasses} onChange={e => set('assetClasses', e.target.value)} placeholder="wonen, logistiek" />
            </div>
            <div className="space-y-1.5">
              <Label>Budget min (€)</Label>
              <Input type="number" value={form.budgetMin} onChange={e => set('budgetMin', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Budget max (€)</Label>
              <Input type="number" value={form.budgetMax} onChange={e => set('budgetMax', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Aankoopcriteria</Label>
            <Textarea value={form.aankoopcriteria} onChange={e => set('aankoopcriteria', e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Verkoopintentie</Label>
            <Textarea value={form.verkoopintentie} onChange={e => set('verkoopintentie', e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Volgende actie</Label>
            <Input value={form.volgendeActie} onChange={e => set('volgendeActie', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notities</Label>
            <Textarea value={form.notities} onChange={e => set('notities', e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Aanmaken')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
