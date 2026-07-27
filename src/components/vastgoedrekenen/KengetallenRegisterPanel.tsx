import { useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Archive, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useKengetallenregister } from '@/hooks/useKengetallenregister';
import { parseDutchNumber } from '@/lib/format/nl';
import {
  KENGETAL_BETROUWBAARHEID_LABELS,
  KENGETAL_CATEGORIE_LABELS,
  KENGETAL_SCENARIOVELD_LABELS,
  isKengetalExpired,
  type KengetalBetrouwbaarheid,
  type KengetalBronType,
  type KengetalCategorie,
  type KengetalDraft,
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
  code: '',
  naam: '',
  categorie: 'rendement',
  eenheid: '%',
  minimum_waarde: 0,
  basis_waarde: 0,
  maximum_waarde: 0,
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

function listText(values: string[]): string {
  return values.join(', ');
}

function parseList(value: string): string[] {
  return Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));
}

function valueText(value: number, unit: string): string {
  const formatted = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(value);
  return unit === '€' ? `€ ${formatted}` : `${formatted}${unit === '%' ? '%' : ` ${unit}`}`;
}

export default function KengetallenRegisterPanel() {
  const { entries, loading, save, setActive } = useKengetallenregister();
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<KengetalDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => showArchived || entry.actief),
    [entries, showArchived],
  );

  function startNew() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, toepassingsgebied: [], regio: [], projectfase: [], risicoklasse: [] });
    setOpen(true);
  }

  function startEdit(entry: VastgoedrekenenKengetal) {
    setEditingId(entry.id);
    setDraft({
      code: entry.code,
      naam: entry.naam,
      categorie: entry.categorie,
      eenheid: entry.eenheid,
      minimum_waarde: entry.minimum_waarde,
      basis_waarde: entry.basis_waarde,
      maximum_waarde: entry.maximum_waarde,
      scenario_veld: entry.scenario_veld,
      bron_type: entry.bron_type,
      bron_naam: entry.bron_naam,
      bron_referentie: entry.bron_referentie,
      bron_peildatum: entry.bron_peildatum,
      geldig_vanaf: entry.geldig_vanaf,
      vervaldatum: entry.vervaldatum,
      toepassingsgebied: [...entry.toepassingsgebied],
      regio: [...entry.regio],
      projectfase: [...entry.projectfase],
      risicoklasse: [...entry.risicoklasse],
      betrouwbaarheid: entry.betrouwbaarheid,
      toelichting: entry.toelichting,
      actief: entry.actief,
    });
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
                Centrale bandbreedtes met bron, peildatum, betrouwbaarheid en vervaldatum. Scenario's gebruiken een eigen momentopname.
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
          {loading && <p className="text-xs text-muted-foreground">Register laden…</p>}
          {!loading && visibleEntries.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              Nog geen {showArchived ? '' : 'actieve '}kengetallen beschikbaar.
            </p>
          )}
          {visibleEntries.map((entry) => {
            const expired = isKengetalExpired(entry);
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
                    {(entry.toepassingsgebied.length > 0 || entry.regio.length > 0 || entry.projectfase.length > 0) && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[listText(entry.toepassingsgebied), listText(entry.regio), listText(entry.projectfase)].filter(Boolean).join(' · ')}
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
            <Field label="Eenheid"><Input value={draft.eenheid} onChange={(event) => setDraft({ ...draft, eenheid: event.target.value })} placeholder="%, €, €/m², maanden…" /></Field>
            <Field label="Minimum"><Input inputMode="decimal" value={String(draft.minimum_waarde).replace('.', ',')} onChange={(event) => setNumber('minimum_waarde', event.target.value)} /></Field>
            <Field label="Basis"><Input inputMode="decimal" value={String(draft.basis_waarde).replace('.', ',')} onChange={(event) => setNumber('basis_waarde', event.target.value)} /></Field>
            <Field label="Maximum"><Input inputMode="decimal" value={String(draft.maximum_waarde).replace('.', ',')} onChange={(event) => setNumber('maximum_waarde', event.target.value)} /></Field>
            <Field label="Scenario-koppeling">
              <Select value={draft.scenario_veld ?? '__none__'} onValueChange={(value) => setDraft({ ...draft, scenario_veld: value === '__none__' ? null : value as KengetalScenarioVeld })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Alleen snapshot / onderbouwing</SelectItem>
                  {Object.entries(KENGETAL_SCENARIOVELD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <Field label="Betrouwbaarheid">
              <Select value={draft.betrouwbaarheid} onValueChange={(value) => setDraft({ ...draft, betrouwbaarheid: value as KengetalBetrouwbaarheid })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(KENGETAL_BETROUWBAARHEID_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Toepassingsgebied"><Input value={listText(draft.toepassingsgebied)} onChange={(event) => setDraft({ ...draft, toepassingsgebied: parseList(event.target.value) })} placeholder="transformatie, nieuwbouw" /></Field>
            <Field label="Regio"><Input value={listText(draft.regio)} onChange={(event) => setDraft({ ...draft, regio: parseList(event.target.value) })} placeholder="Den Haag, Randstad" /></Field>
            <Field label="Projectfase"><Input value={listText(draft.projectfase)} onChange={(event) => setDraft({ ...draft, projectfase: parseList(event.target.value) })} placeholder="haalbaarheid, bieding" /></Field>
            <Field label="Risicoklasse"><Input value={listText(draft.risicoklasse)} onChange={(event) => setDraft({ ...draft, risicoklasse: parseList(event.target.value) })} placeholder="basis, voorzichtig" /></Field>
            <Field label="Toelichting" className="sm:col-span-2"><Textarea rows={3} value={draft.toelichting ?? ''} onChange={(event) => setDraft({ ...draft, toelichting: event.target.value || null })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ''}`}><Label>{label}</Label>{children}</div>;
}
