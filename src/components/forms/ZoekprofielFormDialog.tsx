import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useDataStore } from '@/hooks/useDataStore';
import type { Zoekprofiel, AssetClass, VerhuurStatus, ZoekprofielStatus } from '@/data/mock-data';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoekprofiel?: Zoekprofiel | null;
  defaultRelatieId?: string;
}

const assetOptions: AssetClass[] = ['wonen', 'winkels', 'bedrijfshallen', 'logistiek', 'industrieel', 'kantoren', 'hotels'];

const emptyForm = {
  naam: '',
  relatieId: '',
  typeVastgoed: [] as AssetClass[],
  regio: '',
  prijsMin: '',
  prijsMax: '',
  oppervlakteMin: '',
  oppervlakteMax: '',
  verhuurStatus: '' as VerhuurStatus | '',
  rendementseis: '',
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  aanvullendeCriteria: '',
  status: 'actief' as ZoekprofielStatus,
};

export default function ZoekprofielFormDialog({ open, onOpenChange, zoekprofiel, defaultRelatieId }: Props) {
  const { addZoekprofiel, updateZoekprofiel, relaties } = useDataStore();
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!zoekprofiel;

  useEffect(() => {
    if (zoekprofiel) {
      setForm({
        naam: zoekprofiel.naam,
        relatieId: zoekprofiel.relatieId,
        typeVastgoed: zoekprofiel.typeVastgoed,
        regio: zoekprofiel.regio.join(', '),
        prijsMin: zoekprofiel.prijsMin?.toString() || '',
        prijsMax: zoekprofiel.prijsMax?.toString() || '',
        oppervlakteMin: zoekprofiel.oppervlakteMin?.toString() || '',
        oppervlakteMax: zoekprofiel.oppervlakteMax?.toString() || '',
        verhuurStatus: zoekprofiel.verhuurStatus || '',
        rendementseis: zoekprofiel.rendementseis?.toString() || '',
        ontwikkelPotentie: zoekprofiel.ontwikkelPotentie,
        transformatiePotentie: zoekprofiel.transformatiePotentie,
        aanvullendeCriteria: zoekprofiel.aanvullendeCriteria || '',
        status: zoekprofiel.status,
      });
    } else {
      setForm({ ...emptyForm, relatieId: defaultRelatieId || '' });
    }
  }, [zoekprofiel, open, defaultRelatieId]);

  const toggleType = (t: AssetClass) => {
    setForm(prev => ({
      ...prev,
      typeVastgoed: prev.typeVastgoed.includes(t)
        ? prev.typeVastgoed.filter(x => x !== t)
        : [...prev.typeVastgoed, t],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.naam.trim() || !form.relatieId || form.typeVastgoed.length === 0) {
      toast.error('Naam, relatie en minstens één type vastgoed zijn verplicht');
      return;
    }
    if (form.prijsMin && form.prijsMax && Number(form.prijsMin) > Number(form.prijsMax)) {
      toast.error('Prijs min mag niet groter zijn dan prijs max');
      return;
    }
    if (form.oppervlakteMin && form.oppervlakteMax && Number(form.oppervlakteMin) > Number(form.oppervlakteMax)) {
      toast.error('Oppervlakte min mag niet groter zijn dan oppervlakte max');
      return;
    }

    const data: Omit<Zoekprofiel, 'id'> = {
      naam: form.naam.trim(),
      relatieId: form.relatieId,
      typeVastgoed: form.typeVastgoed,
      regio: form.regio.split(',').map(s => s.trim()).filter(Boolean),
      prijsMin: form.prijsMin ? Number(form.prijsMin) : undefined,
      prijsMax: form.prijsMax ? Number(form.prijsMax) : undefined,
      oppervlakteMin: form.oppervlakteMin ? Number(form.oppervlakteMin) : undefined,
      oppervlakteMax: form.oppervlakteMax ? Number(form.oppervlakteMax) : undefined,
      verhuurStatus: form.verhuurStatus || undefined,
      rendementseis: form.rendementseis ? Number(form.rendementseis) : undefined,
      ontwikkelPotentie: form.ontwikkelPotentie,
      transformatiePotentie: form.transformatiePotentie,
      aanvullendeCriteria: form.aanvullendeCriteria || undefined,
      status: form.status,
    };

    try {
      if (isEdit && zoekprofiel) {
        await updateZoekprofiel(zoekprofiel.id, data);
        toast.success('Zoekprofiel bijgewerkt');
      } else {
        await addZoekprofiel(data);
        toast.success('Zoekprofiel aangemaakt');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Zoekprofiel bewerken' : 'Nieuw zoekprofiel'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Profielnaam *</Label>
              <Input value={form.naam} onChange={e => set('naam', e.target.value)} placeholder="bv. Logistiek Brabant" />
            </div>
            <div className="space-y-1.5">
              <Label>Relatie *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.relatieId}
                onChange={e => set('relatieId', e.target.value)}
                disabled={!!defaultRelatieId}
              >
                <option value="">— Kies relatie —</option>
                {relaties.map(r => <option key={r.id} value={r.id}>{r.bedrijfsnaam}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Type vastgoed *</Label>
            <div className="flex flex-wrap gap-2">
              {assetOptions.map(t => (
                <label key={t} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border cursor-pointer transition-colors capitalize ${
                  form.typeVastgoed.includes(t) ? 'bg-accent/10 border-accent text-accent' : 'border-border text-muted-foreground hover:bg-muted'
                }`}>
                  <Checkbox className="h-3.5 w-3.5" checked={form.typeVastgoed.includes(t)} onCheckedChange={() => toggleType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Regio (kommagescheiden)</Label>
              <Input value={form.regio} onChange={e => set('regio', e.target.value)} placeholder="Randstad, Brabant" />
            </div>
            <div className="space-y-1.5">
              <Label>Verhuurvoorkeur</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.verhuurStatus} onChange={e => set('verhuurStatus', e.target.value)}>
                <option value="">Geen voorkeur</option>
                <option value="verhuurd">Verhuurd</option>
                <option value="leeg">Leeg</option>
                <option value="gedeeltelijk">Gedeeltelijk</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Prijs min (€)</Label>
              <Input type="number" value={form.prijsMin} onChange={e => set('prijsMin', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Prijs max (€)</Label>
              <Input type="number" value={form.prijsMax} onChange={e => set('prijsMax', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Oppervlakte min (m²)</Label>
              <Input type="number" value={form.oppervlakteMin} onChange={e => set('oppervlakteMin', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Oppervlakte max (m²)</Label>
              <Input type="number" value={form.oppervlakteMax} onChange={e => set('oppervlakteMax', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rendementseis (%)</Label>
              <Input type="number" step="0.1" value={form.rendementseis} onChange={e => set('rendementseis', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="actief">Actief</option>
                <option value="pauze">Pauze</option>
                <option value="gearchiveerd">Gearchiveerd</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.ontwikkelPotentie} onCheckedChange={v => set('ontwikkelPotentie', !!v)} /> Interesse in ontwikkelpotentie
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.transformatiePotentie} onCheckedChange={v => set('transformatiePotentie', !!v)} /> Interesse in transformatie
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>Aanvullende criteria</Label>
            <Textarea value={form.aanvullendeCriteria} onChange={e => set('aanvullendeCriteria', e.target.value)} rows={3} />
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
