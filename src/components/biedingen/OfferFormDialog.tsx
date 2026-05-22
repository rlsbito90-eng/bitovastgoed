import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import { useDataStore } from '@/hooks/useDataStore';
import { useBiedingen } from '@/hooks/useBiedingen';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { toast } from 'sonner';
import {
  BIEDING_STATUS_LABELS, BIEDING_TYPE_LABELS, VOORBEHOUD_LABELS,
  KOSTEN_LABELS, BRON_LABELS, BIEDING_RICHTING_LABELS_LONG,
  type Bieding, type BiedingStatus, type BiedingType,
  type VoorbehoudStatus, type KostenType, type BiedingBron, type BiedingRichting,
} from '@/lib/biedingen/types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Bewerken */
  bieding?: Bieding | null;
  /** Voorvulwaarden bij nieuwe bieding */
  defaultObjectId?: string;
  defaultRelatieId?: string;
  defaultDealId?: string;
  defaultObjectPipelineId?: string;
  /** Tegenvoorstel-modus: vorig bod */
  counterTo?: Bieding | null;
  /** Wordt aangeroepen na succesvol opslaan zodat de parent kan refetchen */
  onSaved?: () => void | Promise<void>;
}


const norm = (s?: string | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

interface FormState {
  objectId: string;
  relatieId: string;
  dealId: string;
  bedrag: string;
  bieddatum: string;
  geldigTot: string;
  status: BiedingStatus;
  offerType: BiedingType;
  richting: BiedingRichting;
  financieringsvoorbehoud: VoorbehoudStatus;
  ddVoorbehoud: VoorbehoudStatus;
  gewensteLevering: string;
  gewensteLeveringTekst: string;
  waarborgsomBedrag: string;
  waarborgsomPct: string;
  kostenType: KostenType | '';
  voorwaarden: string;
  notities: string;
  interneNotities: string;
  bron: BiedingBron | '';
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  objectId: '',
  relatieId: '',
  dealId: '',
  bedrag: '',
  bieddatum: today(),
  geldigTot: '',
  status: 'ontvangen',
  offerType: 'indicatief',
  richting: 'van_koper',
  financieringsvoorbehoud: 'onbekend',
  ddVoorbehoud: 'onbekend',
  gewensteLevering: '',
  gewensteLeveringTekst: '',
  waarborgsomBedrag: '',
  waarborgsomPct: '',
  kostenType: '',
  voorwaarden: '',
  notities: '',
  interneNotities: '',
  bron: '',
});

export default function OfferFormDialog({
  open, onOpenChange, bieding,
  defaultObjectId, defaultRelatieId, defaultDealId, defaultObjectPipelineId,
  counterTo, onSaved,
}: Props) {

  const { relaties, contactpersonen, objecten, deals, getObjectById } = useDataStore();
  const isEdit = !!bieding;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [bezig, setBezig] = useState(false);

  // We need a hook scope to call create/update — gebruik object/deal/relatie van form/bieding
  const scopeObjectId = bieding?.objectId ?? defaultObjectId ?? '';
  const { create, update } = useBiedingen(scopeObjectId ? { objectId: scopeObjectId } : { all: true });

  const objectPipelineId = bieding?.objectPipelineId ?? defaultObjectPipelineId ?? null;
  const counterOfferToId = bieding?.counterOfferToId ?? counterTo?.id ?? null;

  useEffect(() => {
    if (!open) return;
    if (bieding) {
      setForm({
        objectId: bieding.objectId,
        relatieId: bieding.relatieId,
        dealId: bieding.dealId ?? '',
        bedrag: bieding.bedrag != null ? String(bieding.bedrag) : '',
        bieddatum: bieding.bieddatum,
        geldigTot: bieding.geldigTot ?? '',
        status: bieding.status,
        offerType: bieding.offerType,
        richting: bieding.richting ?? 'van_koper',
        financieringsvoorbehoud: bieding.financieringsvoorbehoud,
        ddVoorbehoud: bieding.ddVoorbehoud,
        gewensteLevering: bieding.gewensteLevering ?? '',
        gewensteLeveringTekst: bieding.gewensteLeveringTekst ?? '',
        waarborgsomBedrag: bieding.waarborgsomBedrag != null ? String(bieding.waarborgsomBedrag) : '',
        waarborgsomPct: bieding.waarborgsomPct != null ? String(bieding.waarborgsomPct) : '',
        kostenType: (bieding.kostenType as KostenType) || '',
        voorwaarden: bieding.voorwaarden ?? '',
        notities: bieding.notities ?? '',
        interneNotities: bieding.interneNotities ?? '',
        bron: (bieding.bron as BiedingBron) || '',
      });
    } else {
      setForm({
        ...emptyForm(),
        objectId: defaultObjectId ?? '',
        relatieId: defaultRelatieId ?? '',
        dealId: defaultDealId ?? '',
        ...(counterTo
          ? {
              objectId: counterTo.objectId,
              relatieId: counterTo.relatieId,
              dealId: counterTo.dealId ?? '',
              offerType: 'tegenvoorstel' as BiedingType,
              status: 'tegenvoorstel_gedaan' as BiedingStatus,
              richting: 'van_verkoper' as BiedingRichting,
              bedrag: '',
              voorwaarden: counterTo.voorwaarden ?? '',
              gewensteLevering: counterTo.gewensteLevering ?? '',
            }
          : {}),
      });
    }
  }, [open, bieding?.id, counterTo?.id, defaultObjectId, defaultRelatieId, defaultDealId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  // Picker items
  const relatieItems = useMemo<EntityPickerItem[]>(() => relaties.map(r => {
    const { primair, secundair } = getRelatieNamen(r, contactpersonen);
    return {
      id: r.id, primair, secundair,
      searchHaystack: norm([primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email].filter(Boolean).join(' ')),
    };
  }), [relaties, contactpersonen]);

  const objectItems = useMemo<EntityPickerItem[]>(() =>
    objecten.filter(o => !o.isArchived).map(o => ({
      id: o.id,
      primair: o.titel || o.adres || '(naamloos object)',
      secundair: [o.plaats, o.status].filter(Boolean).join(' · ') || null,
      searchHaystack: norm([o.titel, o.adres, o.plaats, o.internReferentienummer].filter(Boolean).join(' ')),
    })), [objecten]);

  const dealItems = useMemo<EntityPickerItem[]>(() => deals.filter(d => !d.isArchived).map(d => {
    const obj = getObjectById(d.objectId);
    return {
      id: d.id,
      primair: obj?.titel || obj?.adres || 'Deal',
      secundair: d.fase,
      searchHaystack: norm([obj?.titel, obj?.adres, d.fase].filter(Boolean).join(' ')),
    };
  }), [deals, getObjectById]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.objectId) { toast.error('Object is verplicht.'); return; }
    if (!form.relatieId) { toast.error('Relatie/kandidaat is verplicht.'); return; }
    setBezig(true);
    try {
      const payload: Partial<Bieding> = {
        objectId: form.objectId,
        relatieId: form.relatieId,
        dealId: form.dealId || null,
        objectPipelineId: objectPipelineId,
        counterOfferToId: counterOfferToId,
        bedrag: form.bedrag ? Math.round(parseFloat(form.bedrag.replace(',', '.'))) : null,
        bieddatum: form.bieddatum || today(),
        geldigTot: form.geldigTot || null,
        status: form.status,
        offerType: form.offerType,
        richting: form.richting,
        financieringsvoorbehoud: form.financieringsvoorbehoud,
        ddVoorbehoud: form.ddVoorbehoud,
        gewensteLevering: form.gewensteLevering || null,
        gewensteLeveringTekst: form.gewensteLeveringTekst || null,
        waarborgsomBedrag: form.waarborgsomBedrag ? Math.round(parseFloat(form.waarborgsomBedrag.replace(',', '.'))) : null,
        waarborgsomPct: form.waarborgsomPct ? parseFloat(form.waarborgsomPct.replace(',', '.')) : null,
        kostenType: form.kostenType || null,
        voorwaarden: form.voorwaarden || null,
        notities: form.notities || null,
        interneNotities: form.interneNotities || null,
        bron: form.bron || null,
      };
      if (isEdit && bieding) {
        await update(bieding.id, payload);
        toast.success('Bieding bijgewerkt');
      } else {
        await create(payload);
        toast.success('Bieding toegevoegd');
      }
      await onSaved?.();
      onOpenChange(false);

    } catch (err: any) {
      toast.error(`Opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">{children}</h3>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Bieding bewerken' : counterTo ? 'Tegenvoorstel toevoegen' : 'Bieding toevoegen'}</DialogTitle>
          {counterTo && (
            <DialogDescription>
              Tegenvoorstel op eerder bod van {new Date(counterTo.bieddatum).toLocaleDateString('nl-NL')}.
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1 — Koppeling */}
          <SectionTitle>Koppeling</SectionTitle>
          <div className="grid grid-cols-1 gap-3">
            <EntityPicker
              label="Object" pickerTitle="Kies object"
              value={form.objectId} onChange={v => set('objectId', v)}
              items={objectItems}
            />
            <EntityPicker
              label="Relatie / kandidaat" pickerTitle="Kies relatie"
              value={form.relatieId} onChange={v => set('relatieId', v)}
              items={relatieItems}
            />
            <EntityPicker
              label="Deal (optioneel)" pickerTitle="Kies deal"
              value={form.dealId} onChange={v => set('dealId', v)}
              items={dealItems}
              emptyLabel="Geen gekoppelde deal"
            />
          </div>

          {/* 2 — Bod */}
          <SectionTitle>Bod</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bedrag">Biedbedrag (€)</Label>
              <Input id="bedrag" inputMode="numeric" placeholder="1.350.000"
                value={form.bedrag} onChange={e => set('bedrag', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bieddatum">Bieddatum</Label>
              <Input id="bieddatum" type="date"
                value={form.bieddatum} onChange={e => set('bieddatum', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type bod</Label>
              <Select value={form.offerType} onValueChange={v => set('offerType', v as BiedingType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BIEDING_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as BiedingStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BIEDING_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="geldigTot">Geldig tot</Label>
              <Input id="geldigTot" type="date"
                value={form.geldigTot} onChange={e => set('geldigTot', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bron</Label>
              <Select value={form.bron || 'leeg'} onValueChange={v => set('bron', v === 'leeg' ? '' : (v as BiedingBron))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leeg">—</SelectItem>
                  {Object.entries(BRON_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 3 — Voorwaarden */}
          <SectionTitle>Voorwaarden</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Financieringsvoorbehoud</Label>
              <Select value={form.financieringsvoorbehoud} onValueChange={v => set('financieringsvoorbehoud', v as VoorbehoudStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VOORBEHOUD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due diligence voorbehoud</Label>
              <Select value={form.ddVoorbehoud} onValueChange={v => set('ddVoorbehoud', v as VoorbehoudStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VOORBEHOUD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gewensteLevering">Gewenste levering (datum)</Label>
              <Input id="gewensteLevering" type="date"
                value={form.gewensteLevering} onChange={e => set('gewensteLevering', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gewensteLeveringTekst">Of vrij tekstveld</Label>
              <Input id="gewensteLeveringTekst" placeholder="bv. Q3 2026"
                value={form.gewensteLeveringTekst} onChange={e => set('gewensteLeveringTekst', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kosten</Label>
              <Select value={form.kostenType || 'leeg'} onValueChange={v => set('kostenType', v === 'leeg' ? '' : (v as KostenType))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leeg">—</SelectItem>
                  {Object.entries(KOSTEN_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="wbBedrag">Waarborgsom €</Label>
                <Input id="wbBedrag" inputMode="numeric"
                  value={form.waarborgsomBedrag} onChange={e => set('waarborgsomBedrag', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wbPct">of %</Label>
                <Input id="wbPct" inputMode="decimal"
                  value={form.waarborgsomPct} onChange={e => set('waarborgsomPct', e.target.value)} />
              </div>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="voorwaarden">Extra voorwaarden</Label>
              <Textarea id="voorwaarden" rows={2}
                value={form.voorwaarden} onChange={e => set('voorwaarden', e.target.value)} />
            </div>
          </div>

          {/* 4 — Notities */}
          <SectionTitle>Notities</SectionTitle>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="notities">Notities</Label>
              <Textarea id="notities" rows={2}
                value={form.notities} onChange={e => set('notities', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interneNotities">Interne notities</Label>
              <Textarea id="interneNotities" rows={2}
                value={form.interneNotities} onChange={e => set('interneNotities', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Opslaan…' : isEdit ? 'Bijwerken' : 'Toevoegen'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
