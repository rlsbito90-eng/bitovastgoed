// src/components/forms/DealFormDialog.tsx
// Complete nieuwe Deal-form met tabs:
//   1. Basis      — object, relatie, fase, interesse, data
//   2. Commissie  — %, bedrag, fee-structuur (kern voor rapportage)
//   3. Proces     — DD status, notaris, bank, tegenpartij makelaar
//   4. Notities   — afwijzingsreden, algemene notities

import { useState, useEffect, useMemo, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataStore } from '@/hooks/useDataStore';
import {
  DEAL_FASE_LABELS,
  DD_STATUS_LABELS,
  FASE_KANS,
  formatCurrency,
} from '@/data/mock-data';
import type {
  Deal, DealFase, DDStatus,
} from '@/data/mock-data';
import { toast } from 'sonner';
import { Trophy, AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { getRelatieNamen } from '@/lib/relatieNaam';
import ArchiveerDialog from '@/components/ArchiveerDialog';
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
  fase: 'lead',
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
  referentieanalyseZichtbaar: true,  // default aan
};


export default function DealFormDialog({
  open, onOpenChange, deal, defaultObjectId, defaultRelatieId,
}: Props) {
  const { addDeal, updateDeal, objecten, relaties, getObjectById, contactpersonen, deals, zoekprofielen } = useDataStore();
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

  const num = (v: string) => v === '' ? undefined : Number(v);

  // Auto-bereken commissie-bedrag als vraagprijs bekend + pct ingevuld
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

  const [archiefOpen, setArchiefOpen] = useState(false);
  const [dupAcknowledged, setDupAcknowledged] = useState(false);

  // ---- Picker items ----
  const relatieItems = useMemo<EntityPickerItem[]>(() => {
    return relaties.map(r => {
      const { primair, secundair } = getRelatieNamen(r, contactpersonen);
      const cps = contactpersonen.filter(c => c.relatieId === r.id);
      const haystack = norm([
        primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email, r.telefoon,
        r.vestigingsplaats, r.type, r.status, r.notities,
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



  const persist = async (extra: Partial<Deal> = {}, archiefMelding?: string) => {
    setBezig(true);
    try {
      const payload = { ...form, ...extra };
      if (isEdit && deal) {
        await updateDeal(deal.id, payload);
        toast.success(archiefMelding ?? 'Deal bijgewerkt');
      } else {
        await addDeal(payload);
        toast.success(archiefMelding ?? 'Deal aangemaakt');
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
    const triggertArchief = (form.fase === 'afgerond' || form.fase === 'afgevallen')
      && (!deal || !deal.isArchived);
    if (triggertArchief) {
      setArchiefOpen(true);
      return;
    }
    await persist();
  };

  const gewogenCommissie = form.commissieBedrag
    ? form.commissieBedrag * (FASE_KANS[form.fase] ?? 0)
    : undefined;

  const isAfgerond = form.fase === 'afgerond';
  const isAfgevallen = form.fase === 'afgevallen';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle>
            {isEdit ? 'Deal bewerken' : 'Nieuwe deal'}
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
              <Sectie titel="Koppelingen">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Object *">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.objectId}
                      onChange={e => set('objectId', e.target.value)}
                      disabled={!!defaultObjectId && !isEdit}
                    >
                      <option value="">— Kies object —</option>
                      {objecten.map(o => (
                        <option key={o.id} value={o.id}>{o.titel}</option>
                      ))}
                    </select>
                  </Veld>
                  <Veld label="Primaire relatie *">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.relatieId}
                      onChange={e => set('relatieId', e.target.value)}
                      disabled={!!defaultRelatieId && !isEdit}
                    >
                      <option value="">— Kies relatie —</option>
                      {sorteerRelatiesVoorDropdown(relaties, contactpersonen).map(r => (
                        <option key={r.id} value={r.id}>{getRelatieDropdownLabel(r, contactpersonen)}</option>
                      ))}
                    </select>
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Status & fase">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Fase">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.fase}
                      onChange={e => set('fase', e.target.value as DealFase)}
                    >
                      {Object.entries(DEAL_FASE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
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

                {/* Toggle: referentieanalyse-sectie zichtbaar op deal-detail */}
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
                      Toon marktwaarde-indicatie en gekoppelde referentieobjecten op de deal-detail pagina.
                    </p>
                  </div>
                </label>

                {isAfgerond && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md flex items-start gap-2">
                    <Trophy className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">Deal afgerond — gefeliciteerd!</span>{' '}
                      Deze deal telt mee in de gerealiseerde commissie op het dashboard.
                    </p>
                  </div>
                )}

                {isAfgevallen && (
                  <div className="p-3 bg-muted/40 border border-border rounded-md flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Vul bij Notities de afwijzingsreden in — handig voor toekomstige analyse.
                    </p>
                  </div>
                )}
              </Sectie>

              <Sectie titel="Data">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Datum eerste contact">
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
                  <Veld label="Bezichtiging gepland">
                    <div className="flex gap-2">
                      <Input type="date" value={form.bezichtigingGepland ?? ''}
                        onChange={e => set('bezichtigingGepland', e.target.value || undefined)}
                        className="flex-1" />
                      <Input type="time" value={form.bezichtigingTijd ?? ''}
                        onChange={e => set('bezichtigingTijd', e.target.value || undefined)}
                        className="w-28" placeholder="--:--" />
                    </div>
                  </Veld>
                  <Veld label="Verwachte closingdatum">
                    <Input type="date" value={form.verwachteClosingdatum ?? ''}
                      onChange={e => set('verwachteClosingdatum', e.target.value || undefined)} />
                  </Veld>
                </div>
              </Sectie>

              <Sectie titel="Bod">
                <Veld label="Indicatief bod (€)">
                  <Input type="number" value={form.indicatiefBod ?? ''}
                    onChange={e => set('indicatiefBod', num(e.target.value))} />
                </Veld>
              </Sectie>
            </TabsContent>

            {/* COMMISSIE */}
            <TabsContent value="commissie" className="space-y-5 mt-0">
              <Sectie titel="Commissie">
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-md mb-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vul de commissie-afspraak in zodra die bekend is. Het bedrag gebruikt het
                    dashboard voor de pipeline-waarde (gewogen naar fase) en
                    gerealiseerde commissie (bij afgeronde deals).
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Veld label="Commissie-percentage (%)">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={form.commissiePct ?? ''}
                        onChange={e => set('commissiePct', num(e.target.value))}
                        placeholder="bv. 1.5"
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
                    <Input
                      type="number"
                      value={form.commissieBedrag ?? ''}
                      onChange={e => set('commissieBedrag', num(e.target.value))}
                      placeholder="bv. 45000"
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
                <Sectie titel="Preview voor rapportage">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <PreviewCard
                      label="Commissie (totaal)"
                      value={formatCurrency(form.commissieBedrag)}
                    />
                    <PreviewCard
                      label={`Gewogen pipeline (${Math.round((FASE_KANS[form.fase] ?? 0) * 100)}%)`}
                      value={gewogenCommissie != null ? formatCurrency(gewogenCommissie) : '—'}
                    />
                    <PreviewCard
                      label="Fase"
                      value={DEAL_FASE_LABELS[form.fase]}
                      highlight={isAfgerond}
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
                      placeholder="bv. Notariskantoor X" />
                  </Veld>
                  <Veld label="Bank">
                    <Input value={form.bank ?? ''}
                      onChange={e => set('bank', e.target.value || undefined)}
                      placeholder="bv. ABN AMRO" />
                  </Veld>
                  <Veld label="Tegenpartij makelaar" span={2}>
                    <Input value={form.tegenpartijMakelaar ?? ''}
                      onChange={e => set('tegenpartijMakelaar', e.target.value || undefined)}
                      placeholder="bv. Makelaarskantoor Y" />
                  </Veld>
                </div>
              </Sectie>
            </TabsContent>

            {/* NOTITIES */}
            <TabsContent value="notities" className="space-y-5 mt-0">
              {isAfgevallen && (
                <Sectie titel="Afwijzingsreden">
                  <Veld label="Waarom is deze deal afgevallen?">
                    <Textarea rows={3} value={form.afwijzingsreden ?? ''}
                      onChange={e => set('afwijzingsreden', e.target.value || undefined)}
                      placeholder="bv. tegenpartij heeft te hoog geboden, te weinig oplevering" />
                  </Veld>
                </Sectie>
              )}

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
              {bezig ? 'Bezig…' : (isEdit ? 'Opslaan' : 'Aanmaken')}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
      <ArchiveerDialog
        open={archiefOpen}
        onOpenChange={setArchiefOpen}
        kind="deal"
        defaultReason={form.fase === 'afgerond' ? 'Succesvol afgerond' : 'Koper afgehaakt'}
        showSkip
        triggerHint={`Fase wijzigt naar "${form.fase === 'afgerond' ? 'Afgerond' : 'Afgevallen'}". Archiveer direct mee, of bewaar alleen de fase.`}
        onConfirm={async ({ reason, note }) => {
          setArchiefOpen(false);
          await persist({
            isArchived: true,
            archivedAt: new Date().toISOString(),
            archivedReason: reason,
            archivedNote: note,
          }, 'Deal gearchiveerd en verplaatst naar Archief.');
        }}
        onSkip={() => {
          persist({ isArchived: false, archivedAt: undefined, archivedReason: undefined, archivedNote: undefined });
        }}
      />
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

function PreviewCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-md ${highlight ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/40'}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold font-mono-data mt-0.5">{value}</p>
    </div>
  );
}
