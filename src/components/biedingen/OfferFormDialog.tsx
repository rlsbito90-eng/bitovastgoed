import { useEffect, useMemo, useState } from 'react';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
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
  EXTRA_VOORWAARDEN_LABELS, type ExtraVoorwaarde, type ExtraVoorwaardeType, type VoorbehoudDetails,
  BIEDING_STATUS_LABELS, BIEDING_TYPE_LABELS, BOD_KARAKTER_LABELS, VOORBEHOUD_LABELS,
  KOSTEN_LABELS, BRON_LABELS, BIEDING_RICHTING_LABELS_LONG,
  type Bieding, type BiedingStatus, type BiedingType, type BodKarakter,
  type VoorbehoudStatus, type KostenType, type BiedingBron, type BiedingRichting,
} from '@/lib/biedingen/types';
import { matchingOfferDeals, matchingOfferCandidates, resolveOfferLink } from '@/lib/biedingen/offerLinks';
import { useObjectFeeForecast } from '@/hooks/useObjectFeeForecast';
import { calculateBAR, calculateFactor, getBerekenM2Bron, calculatePricePerM2 } from '@/lib/derivations/financial';
import { parseDutchNumber } from '@/lib/format/nl';
import { antwoordRichtingVoorBod, counterStatusForDirection } from '@/lib/biedingen/progression';

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
  bodKarakter: BodKarakter | '';
  richting: BiedingRichting;
  financieringsvoorbehoud: VoorbehoudStatus;
  ddVoorbehoud: VoorbehoudStatus;
  gewensteLevering: string;
  gewensteLeveringTekst: string;
  waarborgsomBedrag: string;
  waarborgsomPct: string;
  kostenType: KostenType | '';
  voorwaarden: string;
  extraVoorwaarden: ExtraVoorwaarde[] | null;
  origineleCommunicatie: string;
  voorbehoudDetails: VoorbehoudDetails;
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
  bodKarakter: '',
  richting: 'van_koper',
  financieringsvoorbehoud: 'onbekend',
  ddVoorbehoud: 'onbekend',
  gewensteLevering: '',
  gewensteLeveringTekst: '',
  waarborgsomBedrag: '',
  waarborgsomPct: '',
  kostenType: 'kk',
  voorwaarden: '',
  extraVoorwaarden: null,
  origineleCommunicatie: '',
  voorbehoudDetails: {},
  notities: '',
  interneNotities: '',
  bron: '',
});

export default function OfferFormDialog({
  open, onOpenChange, bieding,
  defaultObjectId, defaultRelatieId, defaultDealId, defaultObjectPipelineId,
  counterTo, onSaved,
}: Props) {

  const { relaties, contactpersonen, objecten, deals, pipelineKandidaten, getObjectById } = useDataStore();
  const isEdit = !!bieding;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [bezig, setBezig] = useState(false);

  // We need a hook scope to call create/update — gebruik object/deal/relatie van form/bieding
  const scopeObjectId = form.objectId || bieding?.objectId || counterTo?.objectId || defaultObjectId || '';
  const { create, update, items } = useBiedingen(scopeObjectId ? { objectId: scopeObjectId } : { all: true });

  const candidateMatches = matchingOfferCandidates(pipelineKandidaten, form.objectId, form.relatieId);
  const objectPipelineId = isEdit ? bieding?.objectPipelineId ?? resolveOfferLink(candidateMatches) : resolveOfferLink(candidateMatches, counterTo?.objectPipelineId ?? defaultObjectPipelineId);
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
        bodKarakter: bieding.bodKarakter ?? '',
        richting: bieding.richting ?? 'van_koper',
        financieringsvoorbehoud: bieding.financieringsvoorbehoud,
        ddVoorbehoud: bieding.ddVoorbehoud,
        gewensteLevering: bieding.gewensteLevering ?? '',
        gewensteLeveringTekst: bieding.gewensteLeveringTekst ?? '',
        waarborgsomBedrag: bieding.waarborgsomBedrag != null ? String(bieding.waarborgsomBedrag) : '',
        waarborgsomPct: bieding.waarborgsomPct != null ? String(bieding.waarborgsomPct) : '',
        kostenType: (bieding.kostenType as KostenType) || '',
        voorwaarden: bieding.voorwaarden ?? '',
        extraVoorwaarden: bieding.extraVoorwaarden ?? null,
        origineleCommunicatie: bieding.origineleCommunicatie ?? '',
        voorbehoudDetails: bieding.voorbehoudDetails ?? {},
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
        bron: defaultObjectPipelineId ? 'kandidaat' : '',
        ...(counterTo
          ? {
              objectId: counterTo.objectId,
              relatieId: counterTo.relatieId,
              dealId: counterTo.dealId ?? '',
              offerType: 'tegenvoorstel' as BiedingType,
              status: counterStatusForDirection(antwoordRichtingVoorBod(counterTo)),
              richting: antwoordRichtingVoorBod(counterTo),
              bedrag: '',
              financieringsvoorbehoud: counterTo.financieringsvoorbehoud,
              ddVoorbehoud: counterTo.ddVoorbehoud,
              kostenType: counterTo.kostenType ?? '',
              gewensteLeveringTekst: counterTo.gewensteLeveringTekst ?? '',
              waarborgsomBedrag: counterTo.waarborgsomBedrag != null ? String(counterTo.waarborgsomBedrag) : '',
              waarborgsomPct: counterTo.waarborgsomPct != null ? String(counterTo.waarborgsomPct) : '',
              voorwaarden: counterTo.voorwaarden ?? '',
              extraVoorwaarden: counterTo.extraVoorwaarden ?? null,
              voorbehoudDetails: counterTo.voorbehoudDetails ?? {},
              gewensteLevering: counterTo.gewensteLevering ?? '',
            }
          : {}),
      });
    }
  }, [open, bieding?.id, counterTo?.id, defaultObjectId, defaultRelatieId, defaultDealId, defaultObjectPipelineId]);

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

  const matchingDeals = useMemo(() => matchingOfferDeals(deals, form.objectId, form.relatieId), [deals, form.objectId, form.relatieId]);
  const resolvedDealId = isEdit ? bieding?.dealId ?? null : resolveOfferLink(matchingDeals, form.dealId || counterTo?.dealId);
  const dealItems = useMemo<EntityPickerItem[]>(() => matchingDeals.map(d => {
    const obj = getObjectById(d.objectId);
    return {
      id: d.id,
      primair: obj?.titel || obj?.adres || 'Deal',
      secundair: `Transactiefase: ${d.fase}`,
      searchHaystack: norm([obj?.titel, obj?.adres, 'concrete transactie'].filter(Boolean).join(' ')),
    };
  }), [matchingDeals, getObjectById]);

  const selectedObject = getObjectById(form.objectId);
  const ask = selectedObject?.vraagprijs;
  const annualRent = selectedObject?.huurinkomsten;
  const enteredBid = parseDutchNumber(form.bedrag);
  const positive = (v: number | null | undefined) => v != null && Number.isFinite(v) && v > 0 ? v : null;
  const bidPrice = positive(enteredBid);
  const askingPrice = positive(ask);
  const rent = positive(annualRent);
  const euro = (v: number | null) => v == null ? '—' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  const metric = (v: number | null, suffix: string) => v == null ? '—' : v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
  const area = getBerekenM2Bron(selectedObject, selectedObject?.type);
  const marketValue = positive(selectedObject?.marktwaardeIndicatie);
  const recent = items.filter(b => b.objectId === form.objectId && b.relatieId === form.relatieId && b.id !== bieding?.id && !['concept','afgewezen','ingetrokken','verlopen'].includes(b.status));
  const latestBuyer = recent.find(b => b.richting === 'van_koper' && b.bedrag != null);
  const latestSeller = recent.find(b => ['van_verkoper','namens_verkoper'].includes(b.richting) && b.bedrag != null);
  const comparisonRows = [
    { label: 'Koopsom', ask: euro(askingPrice), bid: euro(bidPrice) },
    { label: 'BAR', ask: metric(rent ? calculateBAR(rent, askingPrice) : null, '%'), bid: metric(rent ? calculateBAR(rent, bidPrice) : null, '%') },
    { label: 'Factor', ask: metric(calculateFactor(askingPrice, rent), '×'), bid: metric(calculateFactor(bidPrice, rent), '×') },
    ...(area.m2 ? [{label: `€/m² (${area.bron.toUpperCase()})`, ask:euro(calculatePricePerM2(askingPrice,area.m2)), bid:euro(calculatePricePerM2(bidPrice,area.m2))}] : []),
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.objectId) { toast.error('Object is verplicht.'); return; }
    if (!form.relatieId) { toast.error('Relatie/kandidaat is verplicht.'); return; }
    if (!isEdit && matchingDeals.length > 1 && !resolvedDealId) { toast.error('Meerdere actieve deals gevonden. Kies de juiste deal.'); return; }
    if (!isEdit && candidateMatches.length > 1 && !objectPipelineId) { toast.error('Meerdere kopertrajecten gevonden. Controleer de koppelingen eerst.'); return; }
    const ingevoerdBedrag = parseDutchNumber(form.bedrag);
    if (!isEdit && (counterTo ? antwoordRichtingVoorBod(counterTo) : form.richting) === 'van_koper' && !form.bodKarakter) {
      toast.error('Geef aan of het kopersbod indicatief of formeel is.');
      return;
    }
    if (form.offerType === 'indicatief' && form.bodKarakter === 'formeel') {
      toast.error('Een bod met type Indicatief kan niet tegelijk als Formeel worden vastgelegd. Kies een ander type bod.');
      return;
    }
    if (counterTo && (ingevoerdBedrag == null || ingevoerdBedrag <= 0)) {
      toast.error('Vul een geldig tegenvoorstelbedrag groter dan € 0 in.');
      return;
    }
    setBezig(true);
    try {
      const payload: Partial<Bieding> = {
        objectId: counterTo?.objectId ?? form.objectId,
        relatieId: counterTo?.relatieId ?? form.relatieId,
        dealId: resolvedDealId,
        objectPipelineId: objectPipelineId,
        counterOfferToId: counterOfferToId,
        bedrag: ingevoerdBedrag == null ? null : Math.round(ingevoerdBedrag),
        bieddatum: form.bieddatum || today(),
        geldigTot: form.geldigTot || null,
        // Definitieve beslissingen lopen uitsluitend via de aparte accepteren/afwijzen-acties.
        ...(!isEdit || !['geaccepteerd', 'afgewezen', 'ingetrokken', 'verlopen'].includes(bieding?.status ?? '')
          ? { status: form.status } : {}),
        offerType: form.offerType,
        bodKarakter: form.bodKarakter || null,
        richting: counterTo ? antwoordRichtingVoorBod(counterTo) : form.richting,
        financieringsvoorbehoud: form.financieringsvoorbehoud,
        ddVoorbehoud: form.ddVoorbehoud,
        gewensteLevering: form.gewensteLevering || null,
        gewensteLeveringTekst: form.gewensteLeveringTekst || null,
        waarborgsomBedrag: (() => { const n = parseDutchNumber(form.waarborgsomBedrag); return n == null ? null : Math.round(n); })(),
        waarborgsomPct: parseDutchNumber(form.waarborgsomPct),
        kostenType: form.kostenType || null,
        voorwaarden: form.voorwaarden || null,
        extraVoorwaarden: form.extraVoorwaarden,
        origineleCommunicatie: form.origineleCommunicatie || null,
        voorbehoudDetails: Object.fromEntries(Object.entries(form.voorbehoudDetails).filter(([key])=>key === 'financiering' ? form.financieringsvoorbehoud !== 'geen' : form.ddVoorbehoud !== 'geen')),
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

  const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Bieding bewerken' : counterTo
            ? antwoordRichtingVoorBod(counterTo) === 'van_koper'
              ? 'Nieuw kopersbod registreren' : 'Tegenvoorstel verkoper registreren'
            : 'Bieding toevoegen'}</DialogTitle>
          {counterTo && (
            <DialogDescription>
              Registratie als antwoord op het bod van {new Date(counterTo.bieddatum).toLocaleDateString('nl-NL')}.
              Leg uitsluitend een voorstel vast dat daadwerkelijk door de betreffende partij is uitgebracht of gecommuniceerd.
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="min-h-0 flex flex-col">
          <div className="min-h-0 overflow-y-auto space-y-3 px-1 pb-3">
          {/* 1 — Koppeling */}
          <SectionTitle>Koppeling</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {counterTo || isEdit ? (
              <div className="sm:col-span-2 rounded-lg border border-border/60 bg-muted/25 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Object:</span> {objectItems.find(o => o.id === form.objectId)?.primair ?? 'Bestaand object'}</p>
                <p><span className="text-muted-foreground">Koper:</span> {relatieItems.find(r => r.id === form.relatieId)?.primair ?? 'Bestaande kandidaat'}</p>
                <p className="text-xs text-muted-foreground">Deze koppeling ligt vast om het onderhandelingsverloop intact te houden.</p>
              </div>
            ) : (
              <>
                <EntityPicker
                  label="Object" pickerTitle="Kies object"
                  value={form.objectId} onChange={v => setForm(old => ({...old, objectId:v, dealId:''}))}
                  items={objectItems}
                />
                <EntityPicker
                  label="Kandidaat / kopertraject" pickerTitle="Kies kandidaat"
                  value={form.relatieId} onChange={v => setForm(old => ({...old, relatieId:v, dealId:''}))}
                  items={relatieItems}
                />

              </>
            )}
            {!isEdit && matchingDeals.length > 1 && (
              <EntityPicker label="Kies bestaande deal" pickerTitle="Kies deal"
                value={resolvedDealId ?? ''} onChange={v => set('dealId', v)}
                items={dealItems} emptyLabel="Selecteer de juiste transactie" />
            )}
            {form.objectId && form.relatieId && (
              <div className="sm:col-span-2 text-xs text-muted-foreground space-y-1">
                <p>{objectPipelineId ? 'Kopertraject gekoppeld.' : 'Een concreet bod wordt verwerkt in het kopertraject.'}</p>
                <p>{resolvedDealId ? 'Bestaande deal gekoppeld.' : matchingDeals.length > 1 && !isEdit ? 'Meerdere deals gevonden; kies de juiste.' : 'Een deal ontstaat bij acceptatie van een kopersbod.'}</p>
              </div>
            )}
          </div>

          {/* 2 — Bod */}
          <SectionTitle>Bod</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bedrag">Biedbedrag (€)</Label>
              <Input id="bedrag" inputMode="decimal" placeholder="1.000.000"
                value={form.bedrag} onChange={e => set('bedrag', e.target.value)}
                onBlur={() => { const n = parseDutchNumber(form.bedrag); if (n != null && Number.isFinite(n)) set('bedrag', n.toLocaleString('nl-NL', { maximumFractionDigits: 2 })); }} />
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
              <Label>Karakter van het bod{!isEdit && (counterTo ? antwoordRichtingVoorBod(counterTo) : form.richting) === 'van_koper' ? ' *' : ''}</Label>
              <Select value={form.bodKarakter || 'leeg'}
                onValueChange={value => set('bodKarakter', value === 'leeg' ? '' : value as BodKarakter)}>
                <SelectTrigger><SelectValue placeholder="Kies indicatief of formeel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leeg">Niet vastgelegd</SelectItem>
                  {Object.entries(BOD_KARAKTER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Formeel betekent expliciet als zodanig uitgebracht; schriftelijk of zonder voorbehoud is niet automatisch formeel.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              {isEdit && bieding && ['geaccepteerd', 'afgewezen', 'ingetrokken', 'verlopen'].includes(bieding.status) ? (
                <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">{BIEDING_STATUS_LABELS[bieding.status]}</div>
              ) : counterTo ? (
                <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">{BIEDING_STATUS_LABELS[form.status]}</div>
              ) : (
                <Select value={form.status} onValueChange={v => set('status', v as BiedingStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BIEDING_STATUS_LABELS)
                      .filter(([k]) => !['geaccepteerd', 'afgewezen', 'ingetrokken', 'verlopen'].includes(k))
                      .map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {!isEdit && !counterTo && <p className="text-[11px] text-muted-foreground">Accepteren of afwijzen kan via de beslisknoppen in het biedboek.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Richting / afzender</Label>
              {counterTo ? (
                <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
                  {BIEDING_RICHTING_LABELS_LONG[form.richting]}
                </div>
              ) : (
                <Select value={form.richting} onValueChange={v => set('richting', v as BiedingRichting)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BIEDING_RICHTING_LABELS_LONG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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

          {selectedObject && (
            <section className="rounded-lg border bg-muted/20 p-3 space-y-2" aria-label="Biedingsanalyse">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <h3 className="text-sm font-semibold">Biedingsanalyse</h3>
                <span className="text-xs text-muted-foreground">Jaarhuur object: {euro(rent)}</span>
              </div>
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs text-muted-foreground"><tr><th scope="col" className="text-left font-normal">Kengetal</th><th scope="col" className="text-right font-normal">Vraagprijs</th><th scope="col" className="text-right font-normal">Bieding</th></tr></thead>
                <tbody>{comparisonRows.map(row => <tr key={row.label} className="border-t"><th scope="row" className="text-left font-normal py-1.5">{row.label}</th><td className="text-right">{row.ask}</td><td className="text-right font-medium">{row.bid}</td></tr>)}</tbody>
              </table>
              {askingPrice && bidPrice ? <p className="text-xs text-muted-foreground">Verschil vraagprijs: {euro(bidPrice - askingPrice)} ({metric((bidPrice / askingPrice - 1) * 100, '%')})</p> : null}
              {marketValue && <p className="text-xs">Interne marktwaarde: {euro(marketValue)}{bidPrice ? ' · Bod: ' + metric(bidPrice / marketValue * 100,'%') + ' van marktwaarde' : ''}</p>}
              {(latestBuyer || latestSeller) && <p className="text-xs">Laatste kopersbod: {euro(latestBuyer?.bedrag ?? null)} · Laatste verkopersvoorstel: {euro(latestSeller?.bedrag ?? null)}</p>}
              {latestBuyer?.bedrag != null && latestSeller?.bedrag != null && <p className="text-xs">Verschil laatste voorstellen: {euro(latestSeller.bedrag-latestBuyer.bedrag)}</p>}
              <OfferFeeEstimate key={form.objectId} objectId={form.objectId} bidPrice={bidPrice} dealPct={matchingDeals.find(d=>d.id===resolvedDealId)?.commissiePct} />
              <p className="text-[11px] text-muted-foreground">{rent ? 'BAR en factor op basis van bruto jaarhuur en koopsom, exclusief bijkomende aankoopkosten.' : 'Geen positieve jaarhuur vastgelegd; BAR en factor zijn niet berekenbaar.'}</p>
            </section>
          )}

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
            {(['financiering','dd'] as const).filter(key => (key === 'financiering' ? form.financieringsvoorbehoud : form.ddVoorbehoud) === 'ja').map(key => {
              const value = form.voorbehoudDetails[key] ?? {toelichting:'',deadline:null};
              const patch = (next: Partial<typeof value>)=>setForm(old=>({...old,voorbehoudDetails:{...old.voorbehoudDetails,[key]:{...value,...next}}}));
              return <div key={key} className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-2">
                <div><Label>{key==='financiering'?'Financiering':'DD'} · toelichting</Label><Input value={value.toelichting} onChange={e=>patch({toelichting:e.target.value})} placeholder="Optioneel" /></div>
                <div><Label>Uiterste datum</Label><Input type="date" value={value.deadline??''} onChange={e=>patch({deadline:e.target.value||null})} /></div>
              </div>;
            })}
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
                <Input id="wbBedrag" inputMode="decimal"
                  value={form.waarborgsomBedrag} onChange={e => set('waarborgsomBedrag', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wbPct">of %</Label>
                <Input id="wbPct" inputMode="decimal"
                  value={form.waarborgsomPct} onChange={e => set('waarborgsomPct', e.target.value)} />
              </div>
            </div>
            <div className="sm:col-span-2 space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Overige gestructureerde voorwaarden</Label>
                <Select value={form.extraVoorwaarden == null ? 'onbekend' : form.extraVoorwaarden.length ? 'aanwezig' : 'geen'}
                  onValueChange={v => set('extraVoorwaarden', v === 'onbekend' ? null : v === 'geen' ? [] : [{type: 'bezichtiging', karakter: 'onbekend', toelichting: '', deadline: null}])}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="onbekend">Onbekend</SelectItem><SelectItem value="geen">Geen</SelectItem><SelectItem value="aanwezig">Aanwezig</SelectItem></SelectContent>
                </Select>
              </div>
              {(form.extraVoorwaarden ?? []).map((condition, index) => {
                const patch = (value: Partial<ExtraVoorwaarde>) => setForm(old => ({...old, extraVoorwaarden: (old.extraVoorwaarden ?? []).map((item, i) => i === index ? {...item, ...value} : item)}));
                return <div key={index} className="rounded-md border bg-background p-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><Label>Type voorwaarde</Label><Select value={condition.type} onValueChange={v => patch({type: v as ExtraVoorwaardeType})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EXTRA_VOORWAARDEN_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Karakter</Label><Select value={condition.karakter} onValueChange={v => patch({karakter: v as ExtraVoorwaarde['karakter']})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="onbekend">Niet vastgesteld</SelectItem><SelectItem value="voorbehoud">Voorbehoud</SelectItem><SelectItem value="transactiebepaling">Transactiebepaling</SelectItem></SelectContent></Select></div>
                    <div><Label>Toelichting</Label><Input value={condition.toelichting} onChange={e => patch({toelichting:e.target.value})} placeholder="Optioneel" /></div>
                    <div><Label>Uiterste datum</Label><Input type="date" value={condition.deadline ?? ''} onChange={e => patch({deadline:e.target.value || null})} /></div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(old => ({...old, extraVoorwaarden: (old.extraVoorwaarden ?? []).filter((_,i) => i !== index)}))}>Voorwaarde verwijderen</Button>
                </div>;
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(old => ({...old, extraVoorwaarden: [...(old.extraVoorwaarden ?? []), {type:'overig', karakter:'onbekend', toelichting:'', deadline:null}]}))}>+ Voorwaarde toevoegen</Button>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="voorwaarden">Aanvullende vrije tekst</Label>
              <Textarea id="voorwaarden" rows={2}
                value={form.voorwaarden} onChange={e => set('voorwaarden', e.target.value)} />
            </div>
          </div>

          {/* 4 — Notities */}
          <SectionTitle>Notities</SectionTitle>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="origineleCommunicatie">Originele biedingscommunicatie</Label>
              <Textarea id="origineleCommunicatie" rows={2} placeholder="Plak het oorspronkelijke bericht of de e-mail" value={form.origineleCommunicatie} onChange={e=>set('origineleCommunicatie',e.target.value)} />
            </div>
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

          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Opslaan…' : isEdit ? 'Bijwerken' : 'Toevoegen'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OfferFeeEstimate({objectId,bidPrice,dealPct}: {objectId:string;bidPrice:number|null;dealPct?:number}) {
  const {forecast,loading} = useObjectFeeForecast(objectId);
  const pct = dealPct ?? forecast.percentage;
  if (loading || bidPrice == null || pct == null || !Number.isFinite(pct) || pct < 0) return null;
  const amount = bidPrice * pct / 100;
  return <p className="text-xs">Indicatieve courtage ({pct.toLocaleString('nl-NL')}%): {amount.toLocaleString('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0})} excl. btw · {dealPct != null ? 'dealpercentage' : 'objectprognose'}</p>;
}
