import { useMemo, useState } from 'react';
import { Archive, MapPinned, Pencil, Plus, RotateCcw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import MultiSelectChips from '@/components/object/MultiSelectChips';
import { useControlledTaxonomy } from '@/hooks/useControlledTaxonomy';
import { useGebiedsvoorkeuren } from '@/hooks/useGebiedsvoorkeuren';
import { taxonomyOptionsFor, taxonomyLabels } from '@/lib/vastgoedrekenen/controlledTaxonomy';
import {
  GEBIEDSBRON_LABELS,
  GEBIEDSNIVEAU_LABELS,
  GEBIEDSVOORKEUR_LABELS,
  gebiedsnaam,
  gebiedspad,
  frequentieSignaal,
  type Gebiedsfrequentie,
  type Gebiedsniveau,
  type Gebiedsvoorkeur,
  type GebiedsvoorkeurBron,
  type GebiedsvoorkeurDraft,
  type GebiedsvoorkeurStatus,
} from '@/lib/acquisitie/gebiedsvoorkeuren';

const EMPTY_DRAFT: GebiedsvoorkeurDraft = {
  location_key: '',
  location_level: 'municipality',
  province_code: null,
  province_name: null,
  municipality_code: null,
  municipality_name: null,
  district_code: null,
  district_name: null,
  neighbourhood_code: null,
  neighbourhood_name: null,
  preference_status: 'watch',
  priority: 3,
  asset_type_codes: [],
  strategy_codes: [],
  motivation: '',
  notes: null,
  source_type: 'manual',
  active: true,
};

function draftFromFrequency(item: Gebiedsfrequentie): GebiedsvoorkeurDraft {
  return {
    ...EMPTY_DRAFT,
    location_key: item.location_key,
    location_level: item.location_level,
    province_code: item.province_code,
    province_name: item.province_name,
    municipality_code: item.municipality_code,
    municipality_name: item.municipality_name,
    district_code: item.district_code,
    district_name: item.district_name,
    neighbourhood_code: item.neighbourhood_code,
    neighbourhood_name: item.neighbourhood_name,
    source_type: 'signal_frequency',
    motivation: `${item.signal_count} Off-Market-signalen aangetroffen; gebied beoordelen voor gerichte acquisitie.`,
  };
}

function draftFromPreference(item: Gebiedsvoorkeur): GebiedsvoorkeurDraft {
  const { id: _id, version: _version, created_by: _createdBy, created_at: _createdAt, updated_at: _updatedAt, ...draft } = item;
  return { ...draft, asset_type_codes: [...item.asset_type_codes], strategy_codes: [...item.strategy_codes] };
}

export default function GebiedsvoorkeurenPanel() {
  const { preferences, frequencies, loading, save, setActive } = useGebiedsvoorkeuren();
  const { options } = useControlledTaxonomy();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GebiedsvoorkeurDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const assetOptions = taxonomyOptionsFor(options, 'asset_type').map((item) => ({ value: item.option_code, label: item.label }));
  const strategyOptions = taxonomyOptionsFor(options, 'strategy').map((item) => ({ value: item.option_code, label: item.label }));
  const visiblePreferences = preferences.filter((item) => showArchived || item.active);
  const knownKeys = useMemo(() => new Set(preferences.map((item) => item.location_key)), [preferences]);
  const suggestions = frequencies.filter((item) => !knownKeys.has(item.location_key)).slice(0, 15);
  const frequencyByKey = useMemo(() => new Map(frequencies.map((item) => [item.location_key, item])), [frequencies]);

  function startManual() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, asset_type_codes: [], strategy_codes: [] });
    setOpen(true);
  }

  function startFromFrequency(item: Gebiedsfrequentie) {
    setEditingId(null);
    setDraft(draftFromFrequency(item));
    setOpen(true);
  }

  function startEdit(item: Gebiedsvoorkeur) {
    setEditingId(item.id);
    setDraft(draftFromPreference(item));
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      const ok = await save(draft, editingId);
      if (ok) setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Waar willen we graag zitten of uitbreiden?</p>
        <p className="mt-1">
          Leg gebieden vooraf vast of sla een gemeente, wijk of buurt op zodra die vaker in Off-Market-signalen voorkomt.
          Frequentie is alleen een aanwijzing: de CRM maakt nooit automatisch een voorkeur of uitsluiting aan.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{preferences.filter((item) => item.active).length} actieve gebieden</Badge>
          <Badge variant="outline">{frequencies.length} gebieden in signalen</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? 'Verberg archief' : 'Toon archief'}
          </Button>
          <Button size="sm" onClick={startManual}><Plus className="mr-1 h-4 w-4" /> Gebied vooraf toevoegen</Button>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Vaker voorkomende gebieden</h3>
        </div>
        {loading && <p className="text-xs text-muted-foreground">Gebiedsdata laden…</p>}
        {!loading && suggestions.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Geen nieuwe gemeente-, wijk- of buurtvoorstellen. Gebieden zonder geo-verrijking tellen hier niet mee.
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {suggestions.map((item) => {
            const signal = frequentieSignaal(item.signal_count);
            return (
              <div key={`${item.location_level}:${item.location_key}`} className="rounded-md border bg-card p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{gebiedsnaam(item)}</p>
                      <Badge variant="outline">{GEBIEDSNIVEAU_LABELS[item.location_level]}</Badge>
                      <Badge variant={signal === 'hoog' ? 'default' : 'secondary'}>{item.signal_count} signalen</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{gebiedspad(item)}</p>
                    <p className="mt-1 text-muted-foreground">
                      {item.active_signal_count} actief · laatste signaal {item.latest_signal_date ?? 'onbekend'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startFromFrequency(item)}>Beoordelen</Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Vastgelegde gebiedsstrategie</h3>
        </div>
        {!loading && visiblePreferences.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Nog geen gebiedsvoorkeuren vastgelegd.</p>
        )}
        <div className="space-y-2">
          {visiblePreferences.map((item) => {
            const frequency = frequencyByKey.get(item.location_key);
            const assetLabels = taxonomyLabels(options, 'asset_type', item.asset_type_codes);
            const strategyLabels = taxonomyLabels(options, 'strategy', item.strategy_codes);
            return (
              <div key={item.id} className={`rounded-md border bg-card p-3 ${item.active ? '' : 'opacity-60'}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{gebiedsnaam(item)}</p>
                      <Badge variant="outline">{GEBIEDSNIVEAU_LABELS[item.location_level]}</Badge>
                      <Badge>{GEBIEDSVOORKEUR_LABELS[item.preference_status]}</Badge>
                      <Badge variant="outline">Prioriteit {item.priority}</Badge>
                      {frequency && <Badge variant="secondary">{frequency.signal_count} signalen</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{gebiedspad(item)}</p>
                    <p className="mt-1 text-xs">{item.motivation}</p>
                    {(assetLabels.length > 0 || strategyLabels.length > 0) && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[assetLabels.join(', '), strategyLabels.join(', ')].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(item)}><Pencil className="mr-1 h-3.5 w-3.5" /> Bewerken</Button>
                    <Button size="sm" variant="ghost" onClick={() => void setActive(item, !item.active)}>
                      {item.active ? <Archive className="mr-1 h-3.5 w-3.5" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                      {item.active ? 'Archiveren' : 'Herstellen'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Gebiedsvoorkeur bewerken' : 'Gebied beoordelen'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Gebiedsniveau">
              <Select value={draft.location_level} onValueChange={(value) => setDraft({ ...draft, location_level: value as Gebiedsniveau, location_key: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(GEBIEDSNIVEAU_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Strategische status">
              <Select value={draft.preference_status} onValueChange={(value) => setDraft({ ...draft, preference_status: value as GebiedsvoorkeurStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(GEBIEDSVOORKEUR_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Provincie"><Input value={draft.province_name ?? ''} onChange={(event) => setDraft({ ...draft, province_name: event.target.value || null })} /></Field>
            <Field label="Provinciecode"><Input value={draft.province_code ?? ''} onChange={(event) => setDraft({ ...draft, province_code: event.target.value || null })} placeholder="Bijvoorbeeld PV28" /></Field>
            {draft.location_level !== 'province' && <>
              <Field label="Gemeente"><Input value={draft.municipality_name ?? ''} onChange={(event) => setDraft({ ...draft, municipality_name: event.target.value || null })} /></Field>
              <Field label="Gemeentecode"><Input value={draft.municipality_code ?? ''} onChange={(event) => setDraft({ ...draft, municipality_code: event.target.value || null })} placeholder="Bijvoorbeeld GM0518" /></Field>
            </>}
            {(draft.location_level === 'district' || draft.location_level === 'neighbourhood') && <>
              <Field label="Wijk"><Input value={draft.district_name ?? ''} onChange={(event) => setDraft({ ...draft, district_name: event.target.value || null })} /></Field>
              <Field label="Wijkcode"><Input value={draft.district_code ?? ''} onChange={(event) => setDraft({ ...draft, district_code: event.target.value || null })} /></Field>
            </>}
            {draft.location_level === 'neighbourhood' && <>
              <Field label="Buurt"><Input value={draft.neighbourhood_name ?? ''} onChange={(event) => setDraft({ ...draft, neighbourhood_name: event.target.value || null })} /></Field>
              <Field label="Buurtcode"><Input value={draft.neighbourhood_code ?? ''} onChange={(event) => setDraft({ ...draft, neighbourhood_code: event.target.value || null })} /></Field>
            </>}
            <Field label="Prioriteit">
              <Select value={String(draft.priority)} onValueChange={(value) => setDraft({ ...draft, priority: Number(value) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4,5].map((value) => <SelectItem key={value} value={String(value)}>{value} — {value === 1 ? 'hoogste' : value === 5 ? 'laagste' : 'normaal'}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Bron van de keuze">
              <Select value={draft.source_type} onValueChange={(value) => setDraft({ ...draft, source_type: value as GebiedsvoorkeurBron })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(GEBIEDSBRON_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Assettypes" className="sm:col-span-2"><MultiSelectChips options={assetOptions} value={draft.asset_type_codes} onChange={(value) => setDraft({ ...draft, asset_type_codes: value })} /></Field>
            <Field label="Strategieën" className="sm:col-span-2"><MultiSelectChips options={strategyOptions} value={draft.strategy_codes} onChange={(value) => setDraft({ ...draft, strategy_codes: value })} /></Field>
            <Field label="Waarom dit gebied?" className="sm:col-span-2"><Textarea rows={3} value={draft.motivation} onChange={(event) => setDraft({ ...draft, motivation: event.target.value })} /></Field>
            <Field label="Aanvullende notities" className="sm:col-span-2"><Textarea rows={2} value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ''}`}><Label>{label}</Label>{children}</div>;
}
