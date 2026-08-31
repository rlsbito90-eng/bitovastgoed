// src/components/forms/DealFormDialog.tsx
// Deal = concrete transactiepositie. De commerciële trajectfase leeft uitsluitend
// op het Object (Object Pipeline) en wordt hier alleen getoond, niet onderhouden.

import { useState, useEffect, useMemo, ReactNode } from 'react';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/ui/number-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataStore } from '@/hooks/useDataStore';
import {
  DD_STATUS_LABELS,
  formatCurrency,
} from '@/data/mock-data';
import type {
  Deal, DDStatus,
} from '@/data/mock-data';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, GitBranch, Info } from 'lucide-react';
import { getRelatieNamen } from '@/lib/relatieNaam';
import EntityPicker, { type EntityPickerItem } from './EntityPicker';

const RECENT_KEY = 'deal-picker-recent';
const readRecent = (kind: string): string[] => {
  try {
    const raw = localStorage.getItem(`${RECENT_KEY}:${kind}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const pushRecent = (kind: string, id: string) => {
  if (!id) return;
  try {
    const cur = readRecent(kind).filter(x => x !== id);
    cur.unshift(id);
    localStorage.setItem(`${RECENT_KEY}:${kind}`, JSON.stringify(cur.slice(0, 8)));
  } catch { /* noop */ }
};
const norm = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  defaultObjectId?: string;
  defaultRelatieId?: string;
}

type FormState = Omit<Deal, 'id' | 'softDeletedAt'>;

const leegForm: FormState = {
  objectId: '',
  relatieId: '',
  // Legacy compatibility projection. Gebruikers onderhouden deze fase niet meer.
  // Een handmatig gestarte transactie begint bij preferred bidder / exclusiviteit,
  // wat in het oude Deal-model het best overeenkomt met 'onderhandeling'.
  fase: 'onderhandeling',
  interessegraad: 3,
  datumEersteContact: new Date().toISOString().split('T')[0],
  datumFollowUp: undefined,
  followUpTijd: undefined,
  bezichtigingGepland: undefined,
  bezichtigingTijd: undefined,
  indicatiefBod: undefined,
  verwachteClosingdatum: undefined,
  commissiePct: undefined,
  commissieBedrag: undefined,
  feeStructuur: undefined,
  ddStatus: 'niet_gestart',
  notaris: undefined,
  bank: undefined,
  tegenpartijMakelaar: undefined,
  afwijzingsreden: undefined,
  notities: undefined,
  referentieanalyseZichtbaar: true,
};

export default function DealFormDialog({
  open, onOpenChange, deal, defaultObjectId, defaultRelatieId,
}: Props) {
  const {
    addDeal,
    updateDeal,
    objecten,
    relaties,
    getObjectById,
    contactpersonen,
    deals,
    zoekprofielen,
    getDefaultObjectPipeline,
    getStagesVoorPipeline,
    setObjectPipelineStage,
  } = useDataStore();
  const isEdit = !!deal;

  const [form, setForm] = useState<FormState>(leegForm);
  const [bezig, setBezig] = useState(false);
  const [tab, setTab] = useState('basis');

  useEffect(() => {
    if (deal) {
      const { id, softDeletedAt, ...rest } = deal;
      setForm({ ...leegForm, ...rest });
    } else {
      setForm({
        ...leegForm,
        objectId: defaultObjectId ?? '',
        relatieId: defaultRelatieId ?? '',
      });
    }
    setTab('basis');
  }, [deal, open, defaultObjectId, defaultRelatieId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const selectedObject = form.objectId ? getObjectById(form.objectId) : undefined;
  const defaultPipeline = getDefaultObjectPipeline();
  const objectStages = defaultPipeline ? getStagesVoorPipeline(defaultPipeline.id) : [];
  const currentObjectStage = selectedObject?.pipelineStageId
    ? objectStages.find(s => s.id === selectedObject.pipelineStageId)
    : undefined;
  const preferredBidderStage = objectStages.find(s => s.slug === 'preferred_bidder');
  const pipelineProbability = currentObjectStage?.probability != null
    ? currentObjectStage.probability / 100
    : 0;

  // Auto-bereken commissie-bedrag als vraagprijs bekend + pct ingevuld.
  // In fase 2 verhuist de prognose naar het Object; bestaande Deal-fees blijven
  // hier bewerkbaar als contract-/transactiegegeven.
  const autoBerekenCommissie = () => {
    if (!form.commissiePct || !form.objectId) return;
    const obj = getObjectById(form.objectId);
    const vraagprijs = obj?.vraagprijs;
    if (vraagprijs) {
      const bedrag = Math.round(vraagprijs * (form.commissiePct / 100));
      set('commissieBedrag', bedrag);
      toast.success(`Commissie berekend: ${formatCurrency(bedrag)}`);
    } else {
      toast.error('Geen vraagprijs bekend op het object');
    }
  };

  const [dupAcknowledged, setDupAcknowledged] = useState(false);

  // ---- Picker items ----
  const relatieItems = useMemo<EntityPickerItem[]>(() => {
    return relaties.map(r => {
      const { primair, secundair } = getRelatieNamen(r, contactpersonen);
      const cps = contactpersonen.filter(c => c.relatieId === r.id);
      const haystack = norm([
        primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email, r.telefoon,
        r.vestigingsplaats, r.type, (r as any).status, r.notities,
        ...cps.flatMap(c => [c.naam, c.email, c.telefoon, c.functie]),
        ...((r.regio as string[] | undefined) || []),
      ].filter(Boolean).join(' '));
      return { id: r.id, primair, secundair, searchHaystack: haystack };
    });
  }, [relaties, contactpersonen]);

  const { objectItemsActief, objectItemsArchief } = useMemo(() => {
    const map = (o: typeof objecten[number]): EntityPickerItem => {
      const primair = o.titel || o.adres || '(naamloos object)';
      const sec = [o.plaats, o.status, o.type].filter(Boolean).join(' · ');
      const haystack = norm([
        o.titel, o.adres, o.plaats, o.provincie, o.internReferentienummer,
        o.type, o.status, (o as any).aanbiedingswijze, (o as any).interneOpmerkingen, (o as any).opmerkingen,
      ].filter(Boolean).join(' '));
      return { id: o.id, primair, secundair: sec || null, searchHaystack: haystack };
    };
    return {
      objectItemsActief: objecten.filter(o => !o.isArchived).map(map),
      objectItemsArchief: objecten.filter(o => o.isArchived).map(map),
    };
  }, [objecten]);

  // ---- Relevantie tussen object en relatie ----
  const relevantRelatieIds = useMemo(() => {
    if (!form.objectId) return [];
    const ids = new Set<string>();
    deals.forEach(d => { if (d.objectId === form.objectId) ids.add(d.relatieId); });
    zoekprofielen.forEach(z => {
      if ((z as any).status === 'actief' && z.relatieId) ids.add(z.relatieId);
    });
    return Array.from(ids);
  }, [deals, zoekprofielen, form.objectId]);

  const relevantObjectIds = useMemo(() => {
    if (!form.relatieId) return [];
    const ids = new Set<string>();
    deals.forEach(d => { if (d.relatieId === form.relatieId) ids.add(d.objectId); });
    return Array.from(ids);
  }, [deals, form.relatieId]);

  // ---- Duplicaatcontrole ----
  const duplicaatDeal = useMemo(() => {
    if (!form.objectId || !form.relatieId) return null;
    return deals.find(d =>
      d.id !== deal?.id &&
      !d.isArchived &&
      d.objectId === form.objectId &&
      d.relatieId === form.relatieId
    ) || null;
  }, [deals, form.objectId, form.relatieId, deal?.id]);

  useEffect(() => { setDupAcknowledged(false); }, [form.objectId, form.relatieId]);

  const persist = async () => {
    setBezig(true);
    try {
      if (isEdit && deal) {
        await updateDeal(deal.id, form);
        toast.success('Deal bijgewerkt');
      } else {
        await addDeal({ ...form, fase: 'onderhandeling' });

        // Handmatig een Deal starten is alleen bedoeld voor een expliciete
        // preferred-bidder/exclusieve positie zonder formeel bod in de CRM.
        if (form.objectId && preferredBidderStage) {
          await setObjectPipelineStage(form.objectId, preferredBidderStage.id, { manual: false });
        }
        toast.success('Transactie-Deal gestart. Object staat op Preferred bidder / exclusiviteit.');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  const handleSave = async () => {
    if (bezig) return;
    if (!form.objectId) {
      toast.error('Kies een object');
      setTab('basis');
      return;
    }
    if (!form.relatieId) {
      toast.error('Kies een relatie');
      setTab('basis');
      return;
    }
    if (duplicaatDeal && !dupAcknowledged) {
      toast.error('Er bestaat al een deal voor deze relatie en dit object. Bevestig hieronder om toch door te gaan.');
      setTab('basis');
      return;
    }
    if (!isEdit && !preferredBidderStage) {
      toast.error('De fase Preferred bidder / exclusiviteit ontbreekt nog in de Object Pipeline. Voer eerst de CRM-migratie uit.');
      return;
    }
    pushRecent('object', form.objectId);
    pushRecent('relatie', form.relatieId);
    await persist();
  };

  const gewogenCommissie = form.commissieBedrag
    ? form.commissieBedrag * pipelineProbability
    : undefined;

  const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle>
            {isEdit ? 'Transactie-Deal bewerken' : 'Transactie starten'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-6 pt-3 border-b border-border overflow-x-auto bg-background">
            <TabsList className="inline-flex">
              <TabsTrigger value="basis">Basis</TabsTrigger>
              <TabsTrigger value="commissie">Commissie</TabsTrigger>
              <TabsTrigger value="proces">Proces</TabsTrigger>
              <TabsTrigger value="notities">Notities</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {/* BASIS */}
            <TabsContent value="basis" className="space-y-5 mt-0">
              {!isEdit && (
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-md flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Start hier alleen handmatig een Deal wanneer één koper expliciet preferred bidder is
                    of exclusief met de verkoper verdergaat. Een geaccepteerd bod maakt deze Deal normaal
                    gesproken automatisch aan.
                  </p>
                </div>
              )}

              <Sectie titel="Koppelingen">
                <div className="grid sm:grid-cols-2 gap-4">
                  <EntityPicker
                    label="Object *"
                    pickerTitle="Kies object"
                    searchPlaceholder="Zoek op adres, plaats, type, intern nr…"
                    emptyLabel="Geen gekoppeld object"
                    value={form.objectId}
                    onChange={(id) => set('objectId', id)}
                    items={objectItemsActief}
                    archivedItems={objectItemsArchief}
                    relevantIds={relevantObjectIds}
                    relevantLabel="Relevant voor deze relatie"
                    recentIds={readRecent('object')}
                  />
                  <EntityPicker
                    label="Preferred bidder / koper *"
                    pickerTitle="Kies relatie"
                    searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…"
                    emptyLabel="Geen gekoppelde relatie"
                    value={form.relatieId}
                    onChange={(id) => set('relatieId', id)}
                    items={relatieItems}
                    relevantIds={relevantRelatieIds}
                    relevantLabel="Relevant voor dit object"
                    recentIds={readRecent('relatie')}
                  />
                </div>

                {duplicaatDeal && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-md flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Mogelijke dubbele transactie.</span>{' '}
                        Er bestaat al een actieve Deal voor deze koper en dit object.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/deals/${duplicaatDeal.id}`}
                          onClick={() => onOpenChange(false)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Bestaande Deal openen
                        </Link>
                        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dupAcknowledged}
                            onChange={(e) => setDupAcknowledged(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-input accent-accent"
                          />
                          Toch nieuwe Deal aanmaken
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </Sectie>

              <Sectie titel="Traject">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Trajectfase">
                    <div className="min-h-10 rounded-md border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">
                        {currentObjectStage?.name ?? (isEdit ? 'Niet ingesteld op object' : 'Preferred bidder / exclusiviteit')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      De trajectfase wordt centraal beheerd via Object → Dealflow.
                    </p>
                  </Veld>
                  <Veld label="Interessegraad (1-5)">
                    <div className="flex items-center gap-1.5 h-10">
                      {[1,2,3,4,5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => set('interessegraad', n)}
                          className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                            form.interessegraad >= n
                              ? 'bg-accent text-accent-foreground border-accent'
                              : 'bg-card border-border hover:bg-muted'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </Veld>
                </div>

                <label className="flex items-start gap-2 p-3 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.referentieanalyseZichtbaar !== false}
                    onChange={e => set('referentieanalyseZichtbaar', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input shrink-0 cursor-pointer accent-accent"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Referentieanalyse tonen</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Toon marktwaarde-indicatie en gekoppelde referentieobjecten op de Deal-detailpagina.
                    </p>
                  </div>
                </label>
              </Sectie>

              <Sectie titel="Data">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Datum transactiepositie">
                    <Input type="date" value={form.datumEersteContact}
                      onChange={e => set('datumEersteContact', e.target.value)} />
                  </Veld>
                  <Veld label="Follow-up datum">
                    <div className="flex gap-2">
                      <Input type="date" value={form.datumFollowUp ?? ''}
                        onChange={e => set('datumFollowUp', e.target.value || undefined)}
                        className="flex-1" />
                      <Input type="time" value={form.followUpTijd ?? ''}
                        onChange={e => set('followUpTijd', e.target.value || undefined)}
                        className="w-28" placeholder="--:--" />
                    </div>
                  </Veld>
                  <Veld label="Verwachte closingdatum">
                    <Input type="date" value={form.verwachteClosingdatum ?? ''}
                      onChange={e => set('verwachteClosingdatum', e.target.value || undefined)} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Transactieprijs">
                <Veld label="Indicatief / geaccepteerd bod (€)">
                  <NumberField value={form.indicatiefBod}
                    onChange={v => set('indicatiefBod', v)} />
                </Veld>
              </Sectie>
            </TabsContent>

            {/* COMMISSIE */}
            <TabsContent value="commissie" className="space-y-5 mt-0">
              <Sectie titel="Contract-/transactiefee">
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-md mb-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Deze velden horen bij de concrete transactie. De eerdere feeprognose wordt in de
                    volgende stap naar het Object verplaatst, zodat voor een prognose geen kunstmatige
                    Deal meer nodig is.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Commissie-percentage (%)">
                    <div className="flex gap-2">
                      <NumberField
                        decimals={2}
                        value={form.commissiePct}
                        onChange={v => set('commissiePct', v)}
                        placeholder="bv. 1,5"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={autoBerekenCommissie}
                        disabled={!form.commissiePct || !form.objectId}
                        title="Bereken commissie-bedrag uit percentage × vraagprijs"
                      >
                        Bereken
                      </Button>
                    </div>
                  </Veld>
                  <Veld label="Commissie-bedrag (€)">
                    <NumberField
                      value={form.commissieBedrag}
                      onChange={v => set('commissieBedrag', v)}
                      placeholder="bv. 25.000"
                    />
                  </Veld>
                </div>

                <Veld label="Fee-structuur">
                  <Textarea
                    rows={2}
                    value={form.feeStructuur ?? ''}
                    onChange={e => set('feeStructuur', e.target.value || undefined)}
                    placeholder="bv. Success fee bij closing, retainer €5.000, gedeeld met tegenpartij"
                  />
                </Veld>
              </Sectie>

              {form.commissieBedrag != null && form.commissieBedrag > 0 && (
                <Sectie titel="Preview">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <PreviewCard
                      label="Commissie (totaal)"
                      value={formatCurrency(form.commissieBedrag)}
                    />
                    <PreviewCard
                      label={`Gewogen (${Math.round(pipelineProbability * 100)}%)`}
                      value={gewogenCommissie != null ? formatCurrency(gewogenCommissie) : '—'}
                    />
                    <PreviewCard
                      label="Objectfase"
                      value={currentObjectStage?.name ?? '—'}
                    />
                  </div>
                </Sectie>
              )}
            </TabsContent>

            {/* PROCES */}
            <TabsContent value="proces" className="space-y-5 mt-0">
              <Sectie titel="Due diligence">
                <Veld label="DD-status">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.ddStatus ?? 'niet_gestart'}
                    onChange={e => set('ddStatus', e.target.value as DDStatus)}
                  >
                    {Object.entries(DD_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Veld>
              </Sectie>

              <Sectie titel="Betrokken partijen">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Notaris">
                    <Input value={form.notaris ?? ''}
                      onChange={e => set('notaris', e.target.value || undefined)}
                      placeholder="bv. notariskantoor" />
                  </Veld>
                  <Veld label="Bank">
                    <Input value={form.bank ?? ''}
                      onChange={e => set('bank', e.target.value || undefined)}
                      placeholder="bv. financier" />
                  </Veld>
                  <Veld label="Tegenpartij makelaar" span={2}>
                    <Input value={form.tegenpartijMakelaar ?? ''}
                      onChange={e => set('tegenpartijMakelaar', e.target.value || undefined)}
                      placeholder="bv. makelaarskantoor" />
                  </Veld>
                </div>
              </Sectie>
            </TabsContent>

            {/* NOTITIES */}
            <TabsContent value="notities" className="space-y-5 mt-0">
              <Sectie titel="Algemene notities">
                <Veld label="Notities">
                  <Textarea rows={6} value={form.notities ?? ''}
                    onChange={e => set('notities', e.target.value || undefined)} />
                </Veld>
              </Sectie>
            </TabsContent>
          </div>

          <div className="shrink-0 border-t border-border px-6 py-3 flex justify-end items-center gap-2 bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={bezig}>
              {bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Transactie starten')}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Sectie({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
        {titel}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Veld({ label, children, span = 1 }: { label: string; children: ReactNode; span?: 1 | 2 }) {
  return (
    <div className={`space-y-1.5 ${span === 2 ? 'sm:col-span-2' : ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-md bg-muted/40">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold font-mono-data mt-0.5">{value}</p>
    </div>
  );
}
