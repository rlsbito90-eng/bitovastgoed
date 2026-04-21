import { useState, useEffect, ReactNode } from 'react';
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
  // Identificatie
  titel: '',
  internReferentienummer: '',
  // Locatie
  adres: '',
  postcode: '',
  plaats: '',
  provincie: '',
  // Classificatie
  type: 'wonen' as AssetClass,
  subcategorie: '',
  status: 'off-market' as ObjectStatus,
  beschikbaarVanaf: '',
  // Financieel
  vraagprijs: '',
  prijsindicatie: '',
  huurinkomsten: '',
  huurPerM2: '',
  brutoAanvangsrendement: '',
  // Verhuur
  verhuurStatus: 'leeg' as VerhuurStatus,
  aantalHuurders: '',
  leegstandPct: '',
  // Oppervlakten
  oppervlakte: '',
  oppervlakteVvo: '',
  oppervlakteBvo: '',
  perceelOppervlakte: '',
  // Bouwkundig / juridisch
  bouwjaar: '',
  energielabel: '',
  onderhoudsstaat: '',
  eigendomssituatie: '',
  erfpachtinformatie: '',
  bestemmingsinformatie: '',
  // Potentie
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  // Bron / intern
  bron: '',
  exclusief: false,
  documentenBeschikbaar: false,
  samenvatting: '',
  opmerkingen: '',
  interneOpmerkingen: '',
};

function Sectie({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">{titel}</h3>
      {children}
    </div>
  );
}

export default function ObjectFormDialog({ open, onOpenChange, object }: Props) {
  const { addObject, updateObject } = useDataStore();
  const [form, setForm] = useState(emptyForm);
  const [bezig, setBezig] = useState(false);
  const isEdit = !!object;

  useEffect(() => {
    if (object) {
      setForm({
        titel: object.titel,
        internReferentienummer: object.internReferentienummer || '',
        adres: object.adres || '',
        postcode: object.postcode || '',
        plaats: object.plaats,
        provincie: object.provincie,
        type: object.type,
        subcategorie: object.subcategorie || '',
        status: object.status,
        beschikbaarVanaf: object.beschikbaarVanaf || '',
        vraagprijs: object.vraagprijs?.toString() || '',
        prijsindicatie: object.prijsindicatie || '',
        huurinkomsten: object.huurinkomsten?.toString() || '',
        huurPerM2: object.huurPerM2?.toString() || '',
        brutoAanvangsrendement: object.brutoAanvangsrendement?.toString() || '',
        verhuurStatus: object.verhuurStatus,
        aantalHuurders: object.aantalHuurders?.toString() || '',
        leegstandPct: object.leegstandPct?.toString() || '',
        oppervlakte: object.oppervlakte?.toString() || '',
        oppervlakteVvo: object.oppervlakteVvo?.toString() || '',
        oppervlakteBvo: object.oppervlakteBvo?.toString() || '',
        perceelOppervlakte: object.perceelOppervlakte?.toString() || '',
        bouwjaar: object.bouwjaar?.toString() || '',
        energielabel: object.energielabel || '',
        onderhoudsstaat: object.onderhoudsstaat || '',
        eigendomssituatie: object.eigendomssituatie || '',
        erfpachtinformatie: object.erfpachtinformatie || '',
        bestemmingsinformatie: object.bestemmingsinformatie || '',
        ontwikkelPotentie: object.ontwikkelPotentie,
        transformatiePotentie: object.transformatiePotentie,
        bron: object.bron || '',
        exclusief: object.exclusief,
        documentenBeschikbaar: object.documentenBeschikbaar,
        samenvatting: object.samenvatting || '',
        opmerkingen: object.opmerkingen || '',
        interneOpmerkingen: object.interneOpmerkingen || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [object, open]);

  const num = (v: string) => (v === '' || v === null ? undefined : Number(v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bezig) return;
    setBezig(true);

    const data: Omit<ObjectVastgoed, 'id'> = {
      titel: form.titel.trim() || 'Onbekend object',
      internReferentienummer: form.internReferentienummer.trim() || undefined,
      adres: form.adres.trim() || undefined,
      postcode: form.postcode.trim() || undefined,
      plaats: form.plaats.trim(),
      provincie: form.provincie.trim(),
      type: form.type,
      subcategorie: form.subcategorie.trim() || undefined,
      status: form.status,
      beschikbaarVanaf: form.beschikbaarVanaf || undefined,
      vraagprijs: num(form.vraagprijs),
      prijsindicatie: form.prijsindicatie.trim() || undefined,
      huurinkomsten: num(form.huurinkomsten),
      huurPerM2: num(form.huurPerM2),
      brutoAanvangsrendement: num(form.brutoAanvangsrendement),
      verhuurStatus: form.verhuurStatus,
      aantalHuurders: num(form.aantalHuurders),
      leegstandPct: num(form.leegstandPct),
      oppervlakte: num(form.oppervlakte),
      oppervlakteVvo: num(form.oppervlakteVvo),
      oppervlakteBvo: num(form.oppervlakteBvo),
      perceelOppervlakte: num(form.perceelOppervlakte),
      bouwjaar: num(form.bouwjaar),
      energielabel: form.energielabel.trim() || undefined,
      onderhoudsstaat: form.onderhoudsstaat.trim() || undefined,
      eigendomssituatie: form.eigendomssituatie.trim() || undefined,
      erfpachtinformatie: form.erfpachtinformatie.trim() || undefined,
      bestemmingsinformatie: form.bestemmingsinformatie.trim() || undefined,
      ontwikkelPotentie: form.ontwikkelPotentie,
      transformatiePotentie: form.transformatiePotentie,
      bron: form.bron.trim() || undefined,
      exclusief: form.exclusief,
      documentenBeschikbaar: form.documentenBeschikbaar,
      samenvatting: form.samenvatting || undefined,
      opmerkingen: form.opmerkingen || undefined,
      interneOpmerkingen: form.interneOpmerkingen || undefined,
      anoniem: false,
      isPortefeuille: false,
      datumToegevoegd: isEdit ? object!.datumToegevoegd : new Date().toISOString().split('T')[0],
    };

    try {
      if (isEdit && object) {
        await updateObject(object.id, data);
        toast.success('Object bijgewerkt');
      } else {
        await addObject(data);
        toast.success('Object aangemaakt');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Object bewerken' : 'Nieuw object'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Sectie titel="Identificatie">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Objectnaam</Label>
                <Input value={form.titel} onChange={e => set('titel', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Intern referentienummer</Label>
                <Input value={form.internReferentienummer} onChange={e => set('internReferentienummer', e.target.value)} />
              </div>
            </div>
          </Sectie>

          <Sectie titel="Locatie">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Adres</Label>
                <Input value={form.adres} onChange={e => set('adres', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Postcode</Label>
                <Input value={form.postcode} onChange={e => set('postcode', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Plaats</Label>
                <Input value={form.plaats} onChange={e => set('plaats', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Provincie</Label>
                <Input value={form.provincie} onChange={e => set('provincie', e.target.value)} />
              </div>
            </div>
          </Sectie>

          <Sectie titel="Classificatie & status">
            <div className="grid sm:grid-cols-2 gap-4">
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
                <Label>Subcategorie</Label>
                <Input value={form.subcategorie} onChange={e => set('subcategorie', e.target.value)} placeholder="bv. solitaire winkel, A-locatie" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="off-market">Off-market</option>
                  <option value="in_onderzoek">In onderzoek</option>
                  <option value="beschikbaar">Beschikbaar</option>
                  <option value="onder_optie">Onder optie</option>
                  <option value="verkocht">Verkocht</option>
                  <option value="ingetrokken">Ingetrokken</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Beschikbaar vanaf</Label>
                <Input type="date" value={form.beschikbaarVanaf} onChange={e => set('beschikbaarVanaf', e.target.value)} />
              </div>
            </div>
          </Sectie>

          <Sectie titel="Financieel">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Vraagprijs (€)</Label>
                <Input type="number" value={form.vraagprijs} onChange={e => set('vraagprijs', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Prijsindicatie</Label>
                <Input value={form.prijsindicatie} onChange={e => set('prijsindicatie', e.target.value)} placeholder="bv. op aanvraag, koers € 5–6 mln" />
              </div>
              <div className="space-y-1.5">
                <Label>Huurinkomsten (€/jr)</Label>
                <Input type="number" value={form.huurinkomsten} onChange={e => set('huurinkomsten', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Huur per m² (€)</Label>
                <Input type="number" step="0.01" value={form.huurPerM2} onChange={e => set('huurPerM2', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bruto aanvangsrendement (%)</Label>
                <Input type="number" step="0.01" value={form.brutoAanvangsrendement} onChange={e => set('brutoAanvangsrendement', e.target.value)} />
              </div>
            </div>
          </Sectie>

          <Sectie titel="Verhuur">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Verhuurstatus</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.verhuurStatus} onChange={e => set('verhuurStatus', e.target.value)}>
                  <option value="verhuurd">Verhuurd</option>
                  <option value="leeg">Leeg</option>
                  <option value="gedeeltelijk">Gedeeltelijk</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Aantal huurders</Label>
                <Input type="number" value={form.aantalHuurders} onChange={e => set('aantalHuurders', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Leegstand (%)</Label>
                <Input type="number" step="0.1" value={form.leegstandPct} onChange={e => set('leegstandPct', e.target.value)} />
              </div>
            </div>
          </Sectie>

          <Sectie titel="Oppervlakten">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Oppervlakte totaal (m²)</Label>
                <Input type="number" value={form.oppervlakte} onChange={e => set('oppervlakte', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>VVO (m²)</Label>
                <Input type="number" value={form.oppervlakteVvo} onChange={e => set('oppervlakteVvo', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>BVO (m²)</Label>
                <Input type="number" value={form.oppervlakteBvo} onChange={e => set('oppervlakteBvo', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Perceeloppervlakte (m²)</Label>
                <Input type="number" value={form.perceelOppervlakte} onChange={e => set('perceelOppervlakte', e.target.value)} />
              </div>
            </div>
          </Sectie>

          <Sectie titel="Bouwkundig & juridisch">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Bouwjaar</Label>
                <Input type="number" value={form.bouwjaar} onChange={e => set('bouwjaar', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Energielabel</Label>
                <Input value={form.energielabel} onChange={e => set('energielabel', e.target.value)} placeholder="A, B, C..." />
              </div>
              <div className="space-y-1.5">
                <Label>Onderhoudsstaat</Label>
                <Input value={form.onderhoudsstaat} onChange={e => set('onderhoudsstaat', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Eigendomssituatie</Label>
                <Input value={form.eigendomssituatie} onChange={e => set('eigendomssituatie', e.target.value)} placeholder="vol eigendom, erfpacht..." />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Erfpachtinformatie</Label>
                <Textarea value={form.erfpachtinformatie} onChange={e => set('erfpachtinformatie', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Bestemmingsinformatie</Label>
                <Textarea value={form.bestemmingsinformatie} onChange={e => set('bestemmingsinformatie', e.target.value)} rows={2} />
              </div>
            </div>
          </Sectie>

          <Sectie titel="Potentie & kenmerken">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.ontwikkelPotentie} onCheckedChange={v => set('ontwikkelPotentie', !!v)} /> Ontwikkelpotentie
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.transformatiePotentie} onCheckedChange={v => set('transformatiePotentie', !!v)} /> Transformatiepotentie
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.exclusief} onCheckedChange={v => set('exclusief', !!v)} /> Exclusief
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.documentenBeschikbaar} onCheckedChange={v => set('documentenBeschikbaar', !!v)} /> Documenten beschikbaar
              </label>
            </div>
          </Sectie>

          <Sectie titel="Bron & opmerkingen">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Bron</Label>
                <Input value={form.bron} onChange={e => set('bron', e.target.value)} placeholder="bv. eigen netwerk, makelaar X" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Samenvatting</Label>
              <Textarea value={form.samenvatting} onChange={e => set('samenvatting', e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Opmerkingen</Label>
              <Textarea value={form.opmerkingen} onChange={e => set('opmerkingen', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Interne opmerkingen</Label>
              <Textarea value={form.interneOpmerkingen} onChange={e => set('interneOpmerkingen', e.target.value)} rows={2} />
            </div>
          </Sectie>

          <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background pb-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Aanmaken')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
