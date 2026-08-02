import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import OptionalDateField from '@/components/forms/OptionalDateField';
import {
  STATUS_LABEL,
  STATUS_VOLGORDE,
  HERKOMST_LABEL,
  PRIORITEIT_LABEL,
  type Vastgoedkans,
  type VastgoedkansStatus,
  type VastgoedkansHerkomst,
} from '@/lib/vastgoedkansen';

const leeg = {
  adres: '',
  postcode: '',
  plaats: '',
  provincie: '',
  typeVastgoed: '',
  korteOmschrijving: '',
  herkomst: 'handmatig' as VastgoedkansHerkomst,
  herkomstReferentie: '',
  status: 'te_beoordelen' as VastgoedkansStatus,
  prioriteit: 3,
  volgendeActieDatum: '',
  volgendeActieOmschrijving: '',
  redenInteressant: '',
  notities: '',
};

export default function VastgoedkansFormDialog({
  open,
  onOpenChange,
  kans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kans?: Vastgoedkans | null;
}) {
  const { addKans, updateKans } = useVastgoedkansen();
  const { propertyTypes, loading: taxonomieLaden } = usePropertyTaxonomie();
  const [form, setForm] = useState(leeg);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    setForm(
      kans
        ? {
            adres: kans.adres ?? '',
            postcode: kans.postcode ?? '',
            plaats: kans.plaats ?? '',
            provincie: kans.provincie ?? '',
            typeVastgoed: kans.typeVastgoed ?? '',
            korteOmschrijving: kans.korteOmschrijving ?? '',
            herkomst: kans.herkomst,
            herkomstReferentie: kans.herkomstReferentie ?? '',
            status: kans.status,
            prioriteit: kans.prioriteit,
            volgendeActieDatum: kans.volgendeActieDatum ?? '',
            volgendeActieOmschrijving: kans.volgendeActieOmschrijving ?? '',
            redenInteressant: kans.redenInteressant ?? '',
            notities: kans.notities ?? '',
          }
        : leeg,
    );
  }, [kans, open]);

  const typeOpties = useMemo(() => {
    const namen = propertyTypes.map((type) => type.name);
    if (form.typeVastgoed && !namen.includes(form.typeVastgoed)) return [form.typeVastgoed, ...namen];
    return namen;
  }, [propertyTypes, form.typeVastgoed]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.adres.trim() || !form.plaats.trim()) {
      toast.error('Adres en plaats zijn verplicht.');
      return;
    }
    setBezig(true);
    try {
      kans ? await updateKans(kans.id, form) : await addKans(form);
      toast.success(kans ? 'Vastgoedkans bijgewerkt.' : 'Vastgoedkans toegevoegd.');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message ?? 'Opslaan mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const selectClass = 'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90dvh] overflow-x-hidden overflow-y-auto p-4 sm:w-full sm:p-6">
        <DialogHeader className="min-w-0">
          <DialogTitle>{kans ? 'Vastgoedkans bewerken' : 'Nieuwe vastgoedkans'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="min-w-0 space-y-4 overflow-x-hidden">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="vk-adres">Adres *</Label>
              <Input id="vk-adres" className="min-w-0" value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="vk-postcode">Postcode</Label>
              <Input id="vk-postcode" className="min-w-0" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="vk-plaats">Plaats *</Label>
              <Input id="vk-plaats" className="min-w-0" value={form.plaats} onChange={(e) => setForm({ ...form, plaats: e.target.value })} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="vk-provincie">Provincie</Label>
              <Input id="vk-provincie" className="min-w-0" value={form.provincie} onChange={(e) => setForm({ ...form, provincie: e.target.value })} />
            </div>
            <div className="min-w-0">
              <Label htmlFor="vk-type">Type vastgoed</Label>
              <select
                id="vk-type"
                className={selectClass}
                value={form.typeVastgoed}
                onChange={(e) => setForm({ ...form, typeVastgoed: e.target.value })}
                disabled={taxonomieLaden}
              >
                <option value="">— Kies type —</option>
                {typeOpties.map((naam) => <option key={naam} value={naam}>{naam}</option>)}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <Label htmlFor="vk-omschrijving">Korte pandomschrijving</Label>
            <Input
              id="vk-omschrijving"
              className="min-w-0"
              value={form.korteOmschrijving}
              onChange={(e) => setForm({ ...form, korteOmschrijving: e.target.value })}
              placeholder="Bijv. ouder bedrijfspand met groot buitenterrein"
            />
            <p className="mt-1 text-xs text-muted-foreground">Een korte herkenbare omschrijving van het pand of de locatie.</p>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <Label htmlFor="vk-herkomst">Herkomst</Label>
              <select id="vk-herkomst" className={selectClass} value={form.herkomst} onChange={(e) => setForm({ ...form, herkomst: e.target.value as VastgoedkansHerkomst })}>
                {Object.entries(HERKOMST_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="vk-status">Status</Label>
              <select id="vk-status" className={selectClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VastgoedkansStatus })}>
                {STATUS_VOLGORDE.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="vk-prioriteit">Prioriteit</Label>
              <select id="vk-prioriteit" className={selectClass} value={form.prioriteit} onChange={(e) => setForm({ ...form, prioriteit: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((waarde) => <option key={waarde} value={waarde}>{PRIORITEIT_LABEL[waarde]}</option>)}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <Label htmlFor="vk-bron">Herkomst / bronreferentie</Label>
            <Input id="vk-bron" className="min-w-0" value={form.herkomstReferentie} onChange={(e) => setForm({ ...form, herkomstReferentie: e.target.value })} placeholder="Bijv. rondrit, CSV-bestand of latere selectierun" />
          </div>

          <div className="min-w-0">
            <Label htmlFor="vk-reden">Waarom interessant?</Label>
            <Textarea id="vk-reden" className="min-w-0 resize-y" rows={2} value={form.redenInteressant} onChange={(e) => setForm({ ...form, redenInteressant: e.target.value })} />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <OptionalDateField id="vk-volgende-actie" label="Volgende actie" value={form.volgendeActieDatum} onChange={(value) => setForm({ ...form, volgendeActieDatum: value })} disabled={bezig} />
            <div className="min-w-0">
              <Label htmlFor="vk-actieomschrijving">Actieomschrijving</Label>
              <Input id="vk-actieomschrijving" className="min-w-0" value={form.volgendeActieOmschrijving} onChange={(e) => setForm({ ...form, volgendeActieOmschrijving: e.target.value })} placeholder="Wat moet er op die datum gebeuren?" />
            </div>
          </div>

          <div className="min-w-0">
            <Label htmlFor="vk-notities">Notities</Label>
            <Textarea id="vk-notities" className="min-w-0 resize-y" rows={3} value={form.notities} onChange={(e) => setForm({ ...form, notities: e.target.value })} />
          </div>

          <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Opslaan…' : kans ? 'Bijwerken' : 'Toevoegen'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
