import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useDataStore } from '@/hooks/useDataStore';
import type { ObjectVastgoed, AssetClass, VerhuurStatus, ObjectStatus } from '@/data/mock-data';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object?: ObjectVastgoed | null;
}

const emptyForm = {
  titel: '',
  plaats: '',
  provincie: '',
  type: 'wonen' as AssetClass,
  vraagprijs: '',
  huurinkomsten: '',
  aantalHuurders: '',
  verhuurStatus: 'verhuurd' as VerhuurStatus,
  oppervlakte: '',
  bouwjaar: '',
  onderhoudsstaat: '',
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  bron: '',
  exclusief: false,
  status: 'off-market' as ObjectStatus,
  samenvatting: '',
  documentenBeschikbaar: false,
  interneOpmerkingen: '',
};

export default function ObjectFormDialog({ open, onOpenChange, object }: Props) {
  const { addObject, updateObject } = useDataStore();
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!object;

  useEffect(() => {
    if (object) {
      setForm({
        titel: object.titel,
        plaats: object.plaats,
        provincie: object.provincie,
        type: object.type,
        vraagprijs: object.vraagprijs?.toString() || '',
        huurinkomsten: object.huurinkomsten?.toString() || '',
        aantalHuurders: object.aantalHuurders?.toString() || '',
        verhuurStatus: object.verhuurStatus,
        oppervlakte: object.oppervlakte?.toString() || '',
        bouwjaar: object.bouwjaar?.toString() || '',
        onderhoudsstaat: object.onderhoudsstaat || '',
        ontwikkelPotentie: object.ontwikkelPotentie,
        transformatiePotentie: object.transformatiePotentie,
        bron: object.bron || '',
        exclusief: object.exclusief,
        status: object.status,
        samenvatting: object.samenvatting || '',
        documentenBeschikbaar: object.documentenBeschikbaar,
        interneOpmerkingen: object.interneOpmerkingen || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [object, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titel.trim() || !form.plaats.trim()) {
      toast.error('Titel en plaats zijn verplicht');
      return;
    }

    const data: Omit<ObjectVastgoed, 'id'> = {
      titel: form.titel.trim(),
      plaats: form.plaats.trim(),
      provincie: form.provincie.trim(),
      type: form.type,
      vraagprijs: form.vraagprijs ? Number(form.vraagprijs) : undefined,
      huurinkomsten: form.huurinkomsten ? Number(form.huurinkomsten) : undefined,
      aantalHuurders: form.aantalHuurders ? Number(form.aantalHuurders) : undefined,
      verhuurStatus: form.verhuurStatus,
      oppervlakte: form.oppervlakte ? Number(form.oppervlakte) : undefined,
      bouwjaar: form.bouwjaar ? Number(form.bouwjaar) : undefined,
      onderhoudsstaat: form.onderhoudsstaat || undefined,
      ontwikkelPotentie: form.ontwikkelPotentie,
      transformatiePotentie: form.transformatiePotentie,
      bron: form.bron || undefined,
      exclusief: form.exclusief,
      status: form.status,
      samenvatting: form.samenvatting || undefined,
      documentenBeschikbaar: form.documentenBeschikbaar,
      interneOpmerkingen: form.interneOpmerkingen || undefined,
      datumToegevoegd: isEdit ? object!.datumToegevoegd : new Date().toISOString().split('T')[0],
    };

    if (isEdit && object) {
      updateObject(object.id, data);
      toast.success('Object bijgewerkt');
    } else {
      addObject(data);
      toast.success('Object aangemaakt');
    }
    onOpenChange(false);
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Object bewerken' : 'Nieuw object'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Objectnaam *</Label>
              <Input value={form.titel} onChange={e => set('titel', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type vastgoed</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="wonen">Wonen</option>
                <option value="winkels">Winkels</option>
                <option value="kantoren">Kantoren</option>
                <option value="logistiek">Logistiek</option>
                <option value="bedrijfshallen">Bedrijfshallen</option>
                <option value="industrieel">Industrieel</option>
                <option value="hotels">Hotels</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Plaats *</Label>
              <Input value={form.plaats} onChange={e => set('plaats', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Provincie</Label>
              <Input value={form.provincie} onChange={e => set('provincie', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vraagprijs (€)</Label>
              <Input type="number" value={form.vraagprijs} onChange={e => set('vraagprijs', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Huurinkomsten (€/jr)</Label>
              <Input type="number" value={form.huurinkomsten} onChange={e => set('huurinkomsten', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Aantal huurders</Label>
              <Input type="number" value={form.aantalHuurders} onChange={e => set('aantalHuurders', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Verhuurstatus</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.verhuurStatus} onChange={e => set('verhuurStatus', e.target.value)}>
                <option value="verhuurd">Verhuurd</option>
                <option value="leeg">Leeg</option>
                <option value="gedeeltelijk">Gedeeltelijk</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Oppervlakte (m²)</Label>
              <Input type="number" value={form.oppervlakte} onChange={e => set('oppervlakte', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bouwjaar</Label>
              <Input type="number" value={form.bouwjaar} onChange={e => set('bouwjaar', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Onderhoudsstaat</Label>
              <Input value={form.onderhoudsstaat} onChange={e => set('onderhoudsstaat', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="off-market">Off-market</option>
                <option value="in_onderzoek">In onderzoek</option>
                <option value="onder_optie">Onder optie</option>
                <option value="verkocht">Verkocht</option>
                <option value="ingetrokken">Ingetrokken</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Bron</Label>
              <Input value={form.bron} onChange={e => set('bron', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.exclusief} onCheckedChange={v => set('exclusief', !!v)} /> Exclusief
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.ontwikkelPotentie} onCheckedChange={v => set('ontwikkelPotentie', !!v)} /> Ontwikkelpotentie
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.transformatiePotentie} onCheckedChange={v => set('transformatiePotentie', !!v)} /> Transformatiepotentie
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.documentenBeschikbaar} onCheckedChange={v => set('documentenBeschikbaar', !!v)} /> Documenten beschikbaar
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Samenvatting</Label>
            <Textarea value={form.samenvatting} onChange={e => set('samenvatting', e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Interne opmerkingen</Label>
            <Textarea value={form.interneOpmerkingen} onChange={e => set('interneOpmerkingen', e.target.value)} rows={2} />
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
