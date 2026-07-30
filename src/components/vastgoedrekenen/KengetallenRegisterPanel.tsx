import { useMemo, useState, type ReactNode } from 'react';
import { Archive, BookOpen, Pencil, Plus, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import MultiSelectChips from '@/components/object/MultiSelectChips';
import { useControlledTaxonomy } from '@/hooks/useControlledTaxonomy';
import { useGebiedsvoorkeuren } from '@/hooks/useGebiedsvoorkeuren';
import { useKengetallenregister } from '@/hooks/useKengetallenregister';
import { parseDutchNumber } from '@/lib/format/nl';
import { gebiedspad } from '@/lib/acquisitie/gebiedsvoorkeuren';
import {
  legacyUnitValue,
  taxonomyLabels,
  taxonomyOptionsFor,
  type TaxonomyDimension,
} from '@/lib/vastgoedrekenen/controlledTaxonomy';
import {
  EMPTY_KENGETAL_CLASSIFICATIE,
  KENGETAL_BETROUWBAARHEID_LABELS,
  KENGETAL_CATEGORIE_LABELS,
  KENGETAL_SCENARIOVELD_LABELS,
  isKengetalExpired,
  type KengetalBetrouwbaarheid,
  type KengetalBronType,
  type KengetalCategorie,
  type KengetalDraft,
  type KengetalProfielBand,
  type KengetalScenarioVeld,
  type VastgoedrekenenKengetal,
} from '@/lib/vastgoedrekenen/kengetallen';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function futureDate(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return isoDate(date);
}

const EMPTY_DRAFT: KengetalDraft = {
  ...EMPTY_KENGETAL_CLASSIFICATIE,
  code: '',
  naam: '',
  categorie: 'rendement',
  eenheid: '%',
  minimum_waarde: 0,
  basis_waarde: 0,
  maximum_waarde: 0,
  conservative_band: null,
  optimistic_band: null,
  scenario_veld: null,
  bron_type: 'extern',
  bron_naam: '',
  bron_referentie: null,
  bron_peildatum: isoDate(new Date()),
  geldig_vanaf: isoDate(new Date()),
  vervaldatum: futureDate(12),
  toepassingsgebied: [],
  regio: [],
  projectfase: [],
  risicoklasse: [],
  betrouwbaarheid: 'middel',
  toelichting: null,
  actief: true,
};

const PROFILE_BAND_LABELS: Record<KengetalProfielBand, string> = {
  minimum: 'Minimum',
  basis: 'Basis',
  maximum: 'Maximum',
};

function valueText(value: number, unit: string): string {
  const formatted = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(value);
  return unit === '€' ? `€ ${formatted}` : `${formatted}${unit === '%' ? '%' : ` ${unit}`}`;
}

function copyDraft(entry: VastgoedrekenenKengetal): KengetalDraft {
  return {
    code: entry.code,
    naam: entry.naam,
    categorie: entry.categorie,
    eenheid: entry.eenheid,
    minimum_waarde: entry.minimum_waarde,
    basis_waarde: entry.basis_waarde,
    maximum_waarde: entry.maximum_waarde,
    conservative_band: entry.conservative_band ?? null,
    optimistic_band: entry.optimistic_band ?? null,
    scenario_veld: entry.scenario_veld,
    bron_type: entry.bron_type,
    bron_naam: entry.bron_naam,
    bron_referentie: entry.bron_referentie,
    bron_peildatum: entry.bron_peildatum,
    geldig_vanaf: entry.geldig_vanaf,
    vervaldatum: entry.vervaldatum,
    toepassingsgebied: [...(entry.toepassingsgebied ?? [])],
    regio: [...(entry.regio ?? [])],
    projectfase: [...(entry.projectfase ?? [])],
    risicoklasse: [...(entry.risicoklasse ?? [])],
    betrouwbaarheid: entry.betrouwbaarheid,
    toelichting: entry.toelichting,
    actief: entry.actief,
    asset_type_codes: [...(entry.asset_type_codes ?? [])],
    strategy_codes: [...(entry.strategy_codes ?? [])],
    project_phase_codes: [...(entry.project_phase_codes ?? [])],
    risk_class_codes: [...(entry.risk_class_codes ?? [])],
    quality_level_codes: [...(entry.quality_level_codes ?? [])],
    complexity_codes: [...(entry.complexity_codes ?? [])],
    location_type_codes: [...(entry.location_type_codes ?? [])],
    market_condition_codes: [...(entry.market_condition_codes ?? [])],
    scenario_profile_codes: [...(entry.scenario_profile_codes ?? [])],
    location_keys: [...(entry.location_keys ?? [])],
    unit_code: entry.unit_code ?? null,
    vat_treatment_code: entry.vat_treatment_code ?? null,
    classification_schema_version: entry.classification_schema_version ?? 1,
  };
}

export default function KengetallenRegisterPanel() {
  const { entries, loading, save, setActive } = useKengetallenregister();
  const { options, loading: taxonomyLoading } = useControlledTaxonomy();
  const { preferences } = useGebiedsvoorkeuren();
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<KengetalDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => showArchived || entry.actief),
    [entries, showArchived],
  );
  const activeAreas = preferences.filter((item) => item.active);
  const areaOptions = activeAreas.map((item) => ({ value: item.location_key, label: gebiedspad(item) }));

  function startNew() {
    setEditingId(null);
    setDraft({
      ...EMPTY_DRAFT,
      ...EMPTY_KENGETAL_CLASSIFICATIE,
      conservative_band: null,
      optimistic_band: null,
      toepassingsgebied: [],
      regio: [],
      projectfase: [],
      risicoklasse: [],
    });
    setOpen(true);
  }

  function startEdit(entry: VastgoedrekenenKengetal) {
    setEditingId(entry.id);
    setDraft(copyDraft(entry));
    setOpen(true);
  }

  function setNumber(field: 'minimum_waarde' | 'basis_waarde' | 'maximum_waarde', raw: string) {
    setDraft((current) => ({ ...current, [field]: parseDutchNumber(raw) ?? 0 }));
  }

  async function submit() {
    setSaving(true);
    try {
      const saved = await save(draft, editingId);
      if (saved) setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function selectedLabels(entry: VastgoedrekenenKengetal): string[] {
    return [
      ...taxonomyLabels(options, 'asset_type', entry.asset_type_codes),
      ...taxonomyLabels(options, 'strategy', entry.strategy_codes),
      ...taxonomyLabels(options, 'project_phase', entry.project_phase_codes),
      ...taxonomyLabels(options, 'quality_level', entry.quality_level_codes),
      ...taxonomyLabels(options, 'complexity', entry.complexity_codes),
    ];
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" /> Kengetallenregister
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Centrale bandbreedtes met vaste vergelijkingscodes, bron, peildatum, betrouwbaarheid en vervaldatum.
                Scenario&apos;s gebruiken een eigen momentopname.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowArchived((value) => !value)}>
                {showArchived ? 'Verberg archief' : 'Toon archief'}
              </Button>
              <Button size="sm" onClick={startNew}><Plus className="mr-1 h-4 w-4" /> Nieuw kengetal</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(loading || taxonomyLoading) && <p className="text-xs text-muted-foreground">Register en dropdowns laden…</p>}
          {!loading && visibleEntries.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              Nog geen {showArchived ? '' : 'actieve '}kengetallen beschikbaar.
            </p>
          )}
          {visibleEntries.map((entry) => {
            const expired = isKengetalExpired(entry);
            const labels = selectedLabels(entry);
            const legacyLabels = [
              ...(entry.toepassingsgebied ?? []),
              ...(entry.regio ?? []),
              ...(entry.projectfase ?? []),
              ...(entry.risicoklasse ?? []),
            ];
            return (
              <div key={entry.id} className={`rounded-md border p-3 ${entry.actief ? '' : 'opacity-60'}`}>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{entry.naam}</p>
                      <Badge variant="outline">{KENGETAL_CATEGORIE_LABELS[entry.categorie]}</Badge>
                      <Badge variant={expired ? 'destructive' : 'secondary'}>{expired ? 'Verlopen' : `Geldig t/m ${entry.vervaldatum}`}</Badge>
                      <Badge variant="outline">Betrouwbaarheid {KENGETAL_BETROUWBAARHEID_LABELS[entry.betrouwbaarheid].toLowerCase()}</Badge>
                      <Badge variant="outline">v{entry.versie}</Badge>
                    </div>
                    <p className="mt-1 font-mono-data text-sm">
                      Min {valueText(entry.minimum_waarde, entry.eenheid)} · Basis {valueText(entry.basis_waarde, entry.eenheid)} · Max {valueText(entry.maximum_waarde, entry.eenheid)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bron: {entry.bron_naam} · peildatum {entry.bron_peildatum}
                      {entry.scenario_veld ? ` · koppeling: ${KENGETAL_SCENARIOVELD_LABELS[entry.scenario_veld]}` : ' · alleen als onderbouwing/snapshot'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Profielrichting: conservatief {entry.conservative_band ? PROFILE_BAND_LABELS[entry.conservative_band].toLowerCase() : 'niet ingericht'}
                      {' · '}optimistisch {entry.optimistic_band ? PROFILE_BAND_LABELS[entry.optimistic_band].toLowerCase() : 'niet ingericht'}
                    </p>
                    {(labels.length > 0 || legacyLabels.length > 0) && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[...labels, ...legacyLabels.map((label) => `${label} (legacy)`)].join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(entry)}><Pencil className="mr-1 h-3.5 w-3.5" /> Bewerken</Button>
                    <Button size="sm" variant="ghost" onClick={() => void setActive(entry, !entry.actief)}>
                      {entry.actief ? <Archive className="mr-1 h-3.5 w-3.5" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                      {entry.actief ? 'Archiveren' : 'Herstellen'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Kengetal bewerken' : 'Nieuw kengetal'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Naam"><Input value={draft.naam} onChange={(event) => setDraft({ ...draft, naam: event.target.value })} /></Field>
            <Field label="Unieke code"><Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_') })} /></Field>
            <Field label="Categorie">
              <Select value={draft.categorie} onValueChange={(value) => setDraft({ ...draft, categorie: value as KengetalCategorie })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(KENGETAL_CATEGORIE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Eenheid">
              <Select
                value={draft.unit_code ?? undefined}
                onValueChange={(value) => setDraft({ ...draft, unit_code: value, eenheid: legacyUnitValue(value, draft.eenheid) })}
              >
                <SelectTrigger><SelectValue placeholder="Kies vaste eenheid" /></SelectTrigger>
                <SelectContent>{taxonomyOptionsFor(options, 'unit').map((item) => <SelectItem key={item.option_code} value={item.option_code}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Minimum"><Input inputMode="decimal" value={String(draft.minimum_waarde).replace('.', ',')} onChange={(event) => setNumber('minimum_waarde', event.target.value)} /></Field>
            <Field label="Basis"><Input inputMode="decimal" value={String(draft.basis_waarde).replace('.', ',')} onChange={(event) => setNumber('basis_waarde', event.target.value)} /></Field>
            <Field label="Maximum"><Input inputMode="decimal" value={String(draft.maximum_waarde).replace('.', ',')} onChange={(event) => setNumber('maximum_waarde', event.target.value)} /></Field>
            <Field label="Btw-behandeling">
              <Select value={draft.vat_treatment_code ?? '__none__'} onValueChange={(value) => setDraft({ ...draft, vat_treatment_code: value === '__none__' ? null : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Niet van toepassing / nog onbekend</SelectItem>
                  {taxonomyOptionsFor(options, 'vat_treatment').map((item) => <SelectItem key={item.option_code} value={item.option_code}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Conservatief profiel gebruikt">
              <Select
                value={draft.conservative_band ?? '__none__'}
                onValueChange={(value) => setDraft({ ...draft, conservative_band: value === '__none__' ? null : value as KengetalProfielBand })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Niet automatisch toepassen</SelectItem>
                  <SelectItem value="minimum">Minimum</SelectItem>
                  <SelectItem value="basis">Basis</SelectItem>
                  <SelectItem value="maximum">Maximum</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Kies bewust welke band voorzichtiger is. Bij kosten is dit vaak maximum; bij opbrengsten vaak minimum.</p>
            </Field>
            <Field label="Optimistisch profiel gebruikt">
              <Select
                value={draft.optimistic_band ?? '__none__'}
                onValueChange={(value) => setDraft({ ...draft, optimistic_band: value === '__none__' ? null : value as KengetalProfielBand })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Niet automatisch toepassen</SelectItem>
                  <SelectItem value="minimum">Minimum</SelectItem>
                  <SelectItem value="basis">Basis</SelectItem>
                  <SelectItem value="maximum">Maximum</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Leg ook hier de richting expliciet vast; de CRM leidt dit niet af uit categorie of veldnaam.</p>
            </Field>

            <Field label="Scenario-koppeling">
              <Select value={draft.scenario_veld ?? '__none__'} onValueChange={(value) => setDraft({ ...draft, scenario_veld: value === '__none__' ? null : value as KengetalScenarioVeld })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Alleen snapshot / onderbouwing</SelectItem>
                  {Object.entries(KENGETAL_SCENARIOVELD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Betrouwbaarheid">
              <Select value={draft.betrouwbaarheid} onValueChange={(value) => setDraft({ ...draft, betrouwbaarheid: value as KengetalBetrouwbaarheid })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(KENGETAL_BETROUWBAARHEID_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>

            <TaxonomyMulti label="Assettypes" dimension="asset_type" options={options} value={draft.asset_type_codes ?? []} onChange={(value) => setDraft({ ...draft, asset_type_codes: value })} />
            <TaxonomyMulti label="Strategieën" dimension="strategy" options={options} value={draft.strategy_codes ?? []} onChange={(value) => setDraft({ ...draft, strategy_codes: value })} />
            <TaxonomyMulti label="Projectfasen" dimension="project_phase" options={options} value={draft.project_phase_codes ?? []} onChange={(value) => setDraft({ ...draft, project_phase_codes: value })} />
            <TaxonomyMulti label="Risicoklassen" dimension="risk_class" options={options} value={draft.risk_class_codes ?? []} onChange={(value) => setDraft({ ...draft, risk_class_codes: value })} />
            <TaxonomyMulti label="Kwaliteitsniveaus" dimension="quality_level" options={options} value={draft.quality_level_codes ?? []} onChange={(value) => setDraft({ ...draft, quality_level_codes: value })} />
            <TaxonomyMulti label="Complexiteit" dimension="complexity" options={options} value={draft.complexity_codes ?? []} onChange={(value) => setDraft({ ...draft, complexity_codes: value })} />
            <TaxonomyMulti label="Locatietypes" dimension="location_type" options={options} value={draft.location_type_codes ?? []} onChange={(value) => setDraft({ ...draft, location_type_codes: value })} />
            <TaxonomyMulti label="Marktomstandigheden" dimension="market_condition" options={options} value={draft.market_condition_codes ?? []} onChange={(value) => setDraft({ ...draft, market_condition_codes: value })} />
            <TaxonomyMulti label="Scenarioprofielen" dimension="scenario_profile" options={options} value={draft.scenario_profile_codes ?? []} onChange={(value) => setDraft({ ...draft, scenario_profile_codes: value })} />
            <Field label="Officiële voorkeursgebieden" className="sm:col-span-2">
              <MultiSelectChips
                options={areaOptions}
                value={draft.location_keys ?? []}
                onChange={(value) => setDraft({ ...draft, location_keys: value })}
                emptyLabel="Leg eerst een gemeente, wijk of buurt vast bij Beheer › Gebiedsvoorkeuren."
              />
            </Field>

            <Field label="Brontype">
              <Select value={draft.bron_type} onValueChange={(value) => setDraft({ ...draft, bron_type: value as KengetalBronType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="extern">Externe bron</SelectItem>
                  <SelectItem value="intern">Interne bron</SelectItem>
                  <SelectItem value="interne_werkhypothese">Interne werkhypothese</SelectItem>
                  <SelectItem value="projectspecifiek">Projectspecifiek</SelectItem>
                  <SelectItem value="methodologie">Methodologie/modelgovernance</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bronnaam"><Input value={draft.bron_naam} onChange={(event) => setDraft({ ...draft, bron_naam: event.target.value })} /></Field>
            <Field label="Bronreferentie"><Input value={draft.bron_referentie ?? ''} onChange={(event) => setDraft({ ...draft, bron_referentie: event.target.value || null })} /></Field>
            <Field label="Bronpeildatum"><Input type="date" value={draft.bron_peildatum} onChange={(event) => setDraft({ ...draft, bron_peildatum: event.target.value })} /></Field>
            <Field label="Geldig vanaf"><Input type="date" value={draft.geldig_vanaf ?? ''} onChange={(event) => setDraft({ ...draft, geldig_vanaf: event.target.value || null })} /></Field>
            <Field label="Vervaldatum"><Input type="date" value={draft.vervaldatum} onChange={(event) => setDraft({ ...draft, vervaldatum: event.target.value })} /></Field>
            <Field label="Toelichting" className="sm:col-span-2"><Textarea rows={3} value={draft.toelichting ?? ''} onChange={(event) => setDraft({ ...draft, toelichting: event.target.value || null })} /></Field>

            {((draft.toepassingsgebied?.length ?? 0) > 0 || (draft.regio?.length ?? 0) > 0 || (draft.projectfase?.length ?? 0) > 0 || (draft.risicoklasse?.length ?? 0) > 0) && (
              <div className="sm:col-span-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
                <p className="font-medium">Bestaande vrije labels blijven bewaard</p>
                <p className="mt-1">
                  {[...(draft.toepassingsgebied ?? []), ...(draft.regio ?? []), ...(draft.projectfase ?? []), ...(draft.risicoklasse ?? [])].join(', ')}.
                  Deze legacylabels worden niet meer gebruikt voor nieuwe vergelijkingen en worden niet automatisch verwijderd.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={() => void submit()} disabled={saving || taxonomyLoading}>{saving ? 'Opslaan…' : 'Opslaan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaxonomyMulti({
  label,
  dimension,
  options,
  value,
  onChange,
}: {
  label: string;
  dimension: TaxonomyDimension;
  options: Parameters<typeof taxonomyOptionsFor>[0];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <Field label={label} className="sm:col-span-2">
      <MultiSelectChips
        options={taxonomyOptionsFor(options, dimension).map((item) => ({ value: item.option_code, label: item.label }))}
        value={value}
        onChange={onChange}
      />
    </Field>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ''}`}><Label>{label}</Label>{children}</div>;
}
