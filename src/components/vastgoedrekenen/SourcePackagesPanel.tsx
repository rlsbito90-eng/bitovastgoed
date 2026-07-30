import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Link2, LockKeyhole, PackageCheck, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useKengetalSourcePackages } from '@/hooks/useKengetalSourcePackages';
import {
  SOURCE_PACKAGE_HEALTH_LABELS,
  SOURCE_PACKAGE_STATUS_LABELS,
  assessSourcePackage,
  type SourcePackageDraft,
  type SourcePackageEntry,
  type VastgoedrekenenSourcePackage,
} from '@/lib/vastgoedrekenen/sourcePackages';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

const EMPTY_DRAFT: SourcePackageDraft = {
  code: '',
  versie: 1,
  naam: '',
  bron_type: 'extern',
  bron_naam: '',
  bron_referentie: null,
  bron_versie: null,
  prijspeildatum: todayIso(),
  geldig_vanaf: todayIso(),
  vervaldatum: futureDate(12),
  valuta_code: 'EUR',
  geografische_scope: null,
  location_keys: [],
  meetgrondslag: null,
  scope_inclusief: null,
  scope_exclusief: null,
  indexeringsmethode: null,
  betrouwbaarheid: 'middel',
  toelichting: null,
  system_managed: false,
};

function copyDraft(pkg: VastgoedrekenenSourcePackage): SourcePackageDraft {
  return {
    code: pkg.code,
    versie: pkg.versie,
    naam: pkg.naam,
    bron_type: pkg.bron_type,
    bron_naam: pkg.bron_naam,
    bron_referentie: pkg.bron_referentie,
    bron_versie: pkg.bron_versie,
    prijspeildatum: pkg.prijspeildatum,
    geldig_vanaf: pkg.geldig_vanaf,
    vervaldatum: pkg.vervaldatum,
    valuta_code: pkg.valuta_code,
    geografische_scope: pkg.geografische_scope,
    location_keys: [...pkg.location_keys],
    meetgrondslag: pkg.meetgrondslag,
    scope_inclusief: pkg.scope_inclusief,
    scope_exclusief: pkg.scope_exclusief,
    indexeringsmethode: pkg.indexeringsmethode,
    betrouwbaarheid: pkg.betrouwbaarheid,
    toelichting: pkg.toelichting,
    system_managed: pkg.system_managed,
  };
}

function dateLabel(value: string | null): string {
  if (!value) return 'niet vastgelegd';
  return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

export default function SourcePackagesPanel() {
  const {
    packages,
    entries,
    entriesByPackage,
    loading,
    saveDraft,
    setEntryPackage,
    approve,
    archive,
  } = useKengetalSourcePackages();
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SourcePackageDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [linkPackageId, setLinkPackageId] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  const linkPackage = packages.find((item) => item.id === linkPackageId) ?? null;
  const sortedEntries = useMemo(() => [...entries].sort((a, b) => a.naam.localeCompare(b.naam, 'nl-NL')), [entries]);

  function startNew() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, location_keys: [] });
    setEditOpen(true);
  }

  function startEdit(pkg: VastgoedrekenenSourcePackage) {
    setEditingId(pkg.id);
    setDraft(copyDraft(pkg));
    setEditOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      const saved = await saveDraft(draft, editingId);
      if (saved) setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEntry(entry: SourcePackageEntry, pkg: VastgoedrekenenSourcePackage) {
    setBusyEntryId(entry.id);
    try {
      await setEntryPackage(entry.id, entry.bronpakket_id === pkg.id ? null : pkg.id);
    } finally {
      setBusyEntryId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageCheck className="h-4 w-4" /> Bronpakketten en prijspeil
              </CardTitle>
              <p className="mt-1 max-w-4xl text-xs text-muted-foreground">
                Groepeer kengetallen onder één bronversie, prijspeil, geografische scope en meetgrondslag.
                Goedkeuring vergrendelt de gekoppelde regels; toepassing op een scenario blijft altijd een afzonderlijke handeling.
              </p>
            </div>
            <Button size="sm" onClick={startNew}><Plus className="mr-1 h-4 w-4" /> Nieuw bronpakket</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Bronpakketten laden…</p>}
          {!loading && packages.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              Nog geen bronpakketten beschikbaar. Pas eerst de Fase 6D.1-migratie toe.
            </p>
          )}

          {packages.map((pkg) => {
            const linkedEntries = entriesByPackage.get(pkg.id) ?? [];
            const assessment = assessSourcePackage(pkg, linkedEntries);
            const canManageLinks = !pkg.system_managed && pkg.status !== 'goedgekeurd';
            return (
              <div key={pkg.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{pkg.naam}</p>
                      <Badge variant="outline">{pkg.code} · v{pkg.versie}</Badge>
                      <Badge variant={assessment.healthy ? 'default' : assessment.healthStatus === 'ongeldig' || assessment.healthStatus === 'verlopen' ? 'destructive' : 'secondary'}>
                        {SOURCE_PACKAGE_HEALTH_LABELS[assessment.healthStatus]}
                      </Badge>
                      <Badge variant="outline">{SOURCE_PACKAGE_STATUS_LABELS[pkg.status]}</Badge>
                      {pkg.system_managed && <Badge variant="outline"><LockKeyhole className="mr-1 h-3 w-3" />Systeembeheerd</Badge>}
                    </div>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                      <p><span className="font-medium text-foreground">Bron:</span> {pkg.bron_naam}</p>
                      <p><span className="font-medium text-foreground">Prijspeil:</span> {dateLabel(pkg.prijspeildatum)}</p>
                      <p><span className="font-medium text-foreground">Geldig t/m:</span> {dateLabel(pkg.vervaldatum)}</p>
                      <p><span className="font-medium text-foreground">Regels:</span> {assessment.linkedEntries}</p>
                      <p className="sm:col-span-2"><span className="font-medium text-foreground">Gebied:</span> {pkg.geografische_scope || 'niet vastgelegd'}</p>
                      <p className="sm:col-span-2"><span className="font-medium text-foreground">Grondslag:</span> {pkg.meetgrondslag || 'niet vastgelegd'}</p>
                    </div>

                    {pkg.bron_referentie && <p className="text-[11px] text-muted-foreground">Referentie: {pkg.bron_referentie}</p>}
                    {assessment.issues.length > 0 && pkg.status !== 'gearchiveerd' && (
                      <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                        <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Nog niet goedkeuringsgereed</p>
                        <p className="mt-1">{assessment.issues.slice(0, 3).map((issue) => issue.message).join(' · ')}</p>
                        {assessment.issues.length > 3 && <p className="mt-1">Daarnaast nog {assessment.issues.length - 3} aandachtspunt(en).</p>}
                      </div>
                    )}
                    {assessment.healthy && (
                      <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Bron- en regelmetadata zijn consistent. Dit zegt niets over marktconformiteit van de inhoudelijke waarden.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1">
                    {pkg.status === 'concept' && !pkg.system_managed && (
                      <Button size="sm" variant="ghost" onClick={() => startEdit(pkg)}><Pencil className="mr-1 h-3.5 w-3.5" /> Bewerken</Button>
                    )}
                    {canManageLinks && (
                      <Button size="sm" variant="ghost" onClick={() => setLinkPackageId(pkg.id)}><Link2 className="mr-1 h-3.5 w-3.5" /> Regels beheren</Button>
                    )}
                    {pkg.status === 'concept' && !pkg.system_managed && (
                      <Button size="sm" onClick={() => void approve(pkg)} disabled={!assessment.canApprove}>
                        <PackageCheck className="mr-1 h-3.5 w-3.5" /> Goedkeuren
                      </Button>
                    )}
                    {pkg.status === 'goedgekeurd' && !pkg.system_managed && (
                      <Button size="sm" variant="outline" onClick={() => void archive(pkg)}><Archive className="mr-1 h-3.5 w-3.5" /> Archiveren</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Governancegrens:</span> een goedgekeurd pakket is een gecontroleerde en reproduceerbare bronset, geen automatische bevestiging dat de waarden marktconform of projectspecifiek passend zijn.
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Conceptbronpakket bewerken' : 'Nieuw conceptbronpakket'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Pakketcode"><Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_') })} /></Field>
            <Field label="Versie"><Input type="number" min={1} step={1} value={draft.versie} onChange={(event) => setDraft({ ...draft, versie: Math.max(1, Number(event.target.value) || 1) })} /></Field>
            <Field label="Naam" className="sm:col-span-2"><Input value={draft.naam} onChange={(event) => setDraft({ ...draft, naam: event.target.value })} /></Field>
            <Field label="Brontype">
              <Select value={draft.bron_type} onValueChange={(value) => setDraft({ ...draft, bron_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="extern">Externe bron</SelectItem>
                  <SelectItem value="projectspecifiek">Projectspecifiek</SelectItem>
                  <SelectItem value="intern">Interne bron</SelectItem>
                  <SelectItem value="interne_werkhypothese">Interne werkhypothese</SelectItem>
                  <SelectItem value="methodologie">Methodologie</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Betrouwbaarheid">
              <Select value={draft.betrouwbaarheid} onValueChange={(value) => setDraft({ ...draft, betrouwbaarheid: value as SourcePackageDraft['betrouwbaarheid'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="laag">Laag</SelectItem>
                  <SelectItem value="middel">Middel</SelectItem>
                  <SelectItem value="hoog">Hoog</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bronnaam"><Input value={draft.bron_naam} onChange={(event) => setDraft({ ...draft, bron_naam: event.target.value })} /></Field>
            <Field label="Bronversie"><Input value={draft.bron_versie ?? ''} onChange={(event) => setDraft({ ...draft, bron_versie: event.target.value || null })} /></Field>
            <Field label="Controleerbare bronreferentie" className="sm:col-span-2"><Input value={draft.bron_referentie ?? ''} onChange={(event) => setDraft({ ...draft, bron_referentie: event.target.value || null })} /></Field>
            <Field label="Prijspeildatum"><Input type="date" value={draft.prijspeildatum ?? ''} onChange={(event) => setDraft({ ...draft, prijspeildatum: event.target.value || null })} /></Field>
            <Field label="Valutacode"><Input maxLength={3} value={draft.valuta_code} onChange={(event) => setDraft({ ...draft, valuta_code: event.target.value.toUpperCase() })} /></Field>
            <Field label="Geldig vanaf"><Input type="date" value={draft.geldig_vanaf ?? ''} onChange={(event) => setDraft({ ...draft, geldig_vanaf: event.target.value || null })} /></Field>
            <Field label="Vervaldatum"><Input type="date" value={draft.vervaldatum ?? ''} onChange={(event) => setDraft({ ...draft, vervaldatum: event.target.value || null })} /></Field>
            <Field label="Geografische scope" className="sm:col-span-2"><Textarea rows={2} value={draft.geografische_scope ?? ''} onChange={(event) => setDraft({ ...draft, geografische_scope: event.target.value || null })} placeholder="Bijvoorbeeld: Nederland, Randstad, gemeente Den Haag of projectspecifieke locatie." /></Field>
            <Field label="Meet- of rekengrondslag" className="sm:col-span-2"><Textarea rows={2} value={draft.meetgrondslag ?? ''} onChange={(event) => setDraft({ ...draft, meetgrondslag: event.target.value || null })} placeholder="Bijvoorbeeld: prijs per m² BVO, GBO, VVO, per eenheid of percentage van GDV." /></Field>
            <Field label="Inbegrepen scope" className="sm:col-span-2"><Textarea rows={3} value={draft.scope_inclusief ?? ''} onChange={(event) => setDraft({ ...draft, scope_inclusief: event.target.value || null })} /></Field>
            <Field label="Uitgesloten scope" className="sm:col-span-2"><Textarea rows={3} value={draft.scope_exclusief ?? ''} onChange={(event) => setDraft({ ...draft, scope_exclusief: event.target.value || null })} /></Field>
            <Field label="Indexerings- of vernieuwingsmethode" className="sm:col-span-2"><Textarea rows={3} value={draft.indexeringsmethode ?? ''} onChange={(event) => setDraft({ ...draft, indexeringsmethode: event.target.value || null })} placeholder="Leg vast hoe en wanneer de set naar een nieuw prijspeil wordt gebracht of volledig wordt vervangen." /></Field>
            <Field label="Toelichting" className="sm:col-span-2"><Textarea rows={3} value={draft.toelichting ?? ''} onChange={(event) => setDraft({ ...draft, toelichting: event.target.value || null })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuleren</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? 'Opslaan…' : 'Concept opslaan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(linkPackage)} onOpenChange={(open) => { if (!open) setLinkPackageId(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Kengetallen koppelen — {linkPackage?.naam}</DialogTitle></DialogHeader>
          {linkPackage && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Alleen ongekoppelde regels kunnen aan een conceptpakket worden toegevoegd. Regels uit een ander pakket moeten daar eerst worden ontkoppeld.
              </p>
              {sortedEntries.map((entry) => {
                const linkedHere = entry.bronpakket_id === linkPackage.id;
                const linkedElsewhere = Boolean(entry.bronpakket_id && !linkedHere);
                const canAttach = linkPackage.status === 'concept' && !linkPackage.system_managed && !linkedElsewhere;
                const canDetach = linkedHere && linkPackage.status !== 'goedgekeurd' && !linkPackage.system_managed;
                return (
                  <div key={entry.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{entry.naam}</p>
                      <p className="text-[11px] text-muted-foreground">{entry.code} · {entry.unit_code ?? 'geen eenheid'} · bron {entry.bron_naam}</p>
                      {linkedElsewhere && <p className="text-[11px] text-amber-700 dark:text-amber-300">Reeds aan een ander bronpakket gekoppeld.</p>}
                    </div>
                    <Button
                      size="sm"
                      variant={linkedHere ? 'outline' : 'secondary'}
                      disabled={busyEntryId === entry.id || (!linkedHere && !canAttach) || (linkedHere && !canDetach)}
                      onClick={() => void toggleEntry(entry, linkPackage)}
                    >
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      {busyEntryId === entry.id ? 'Bezig…' : linkedHere ? 'Ontkoppelen' : 'Koppelen'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setLinkPackageId(null)}>Sluiten</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ''}`}><Label>{label}</Label>{children}</div>;
}
