import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Save,
  Upload,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useControlledTaxonomy } from '@/hooks/useControlledTaxonomy';
import { useKengetalSourcePackages } from '@/hooks/useKengetalSourcePackages';
import { useSourceImportMappingProfiles } from '@/hooks/useSourceImportMappingProfiles';
import { useSourcePackageImport } from '@/hooks/useSourcePackageImport';
import {
  optionalSourceImportFields,
  parseSourceImportFile,
  requiredSourceImportFields,
  SOURCE_IMPORT_MAX_FILE_BYTES,
  suggestSourceImportMapping,
  validateSourceImport,
  type ParsedSourceImportFile,
  type SourceImportColumnDefinition,
  type SourceImportColumnMapping,
} from '@/lib/vastgoedrekenen/sourceImport';
import {
  applySourceImportMappingProfile,
  bestSourceImportMappingProfile,
  mappingProfileColumns,
  type SourceImportMappingProfile,
  type SourceImportMappingProfileDraft,
} from '@/lib/vastgoedrekenen/sourceImportMappingProfiles';
import {
  downloadSourceImportCsvTemplate,
  downloadSourceImportXlsxTemplate,
} from '@/lib/vastgoedrekenen/sourceImportTemplates';
import type { VastgoedrekenenSourcePackage } from '@/lib/vastgoedrekenen/sourcePackages';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function statusBadge(status: 'geldig' | 'fout' | 'conflict') {
  if (status === 'geldig') return <Badge variant="outline" className="text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Geldig</Badge>;
  if (status === 'conflict') return <Badge variant="outline" className="text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />Conflict</Badge>;
  return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Fout</Badge>;
}

export default function SourceImportPanel() {
  const { packages, entries, refetch: refetchPackages } = useKengetalSourcePackages();
  const { options, loading: taxonomyLoading } = useControlledTaxonomy();
  const { runs, loading: runsLoading, importPreview } = useSourcePackageImport();
  const {
    profiles,
    loading: profilesLoading,
    saveProfile,
    archiveProfile,
  } = useSourceImportMappingProfiles();
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [open, setOpen] = useState(false);

  const conceptPackages = useMemo(
    () => packages.filter((pkg) => pkg.status === 'concept' && !pkg.system_managed),
    [packages],
  );
  const selectedPackage = conceptPackages.find((pkg) => pkg.id === selectedPackageId) ?? null;
  const packageNames = new Map(packages.map((pkg) => [pkg.id, `${pkg.naam} · v${pkg.versie}`]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" /> Gecontroleerde bronimport
            </CardTitle>
            <p className="mt-1 max-w-4xl text-xs text-muted-foreground">
              Lees CSV-, XLS- en XLSX-bestanden eerst als controlevoorbeeld in. Kolommen, eenheden, btw, bandbreedten,
              taxonomiecodes en duplicaten worden gecontroleerd voordat één registerregel wordt opgeslagen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={downloadSourceImportCsvTemplate}>
              <Download className="mr-1 h-3.5 w-3.5" /> CSV-sjabloon
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={taxonomyLoading}
              onClick={() => downloadSourceImportXlsxTemplate(options)}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Excel-sjabloon
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Sjabloongrens:</span> de downloads bevatten alleen kolommen,
          instructies en geldige keuzecodes. Ze bevatten geen voorbeeldmarktwaarden. Alleen het tabblad <span className="font-medium">Kengetallen</span> is bedoeld voor importdata.
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>Conceptbronpakket</Label>
            <Select value={selectedPackageId || undefined} onValueChange={setSelectedPackageId}>
              <SelectTrigger><SelectValue placeholder="Kies eerst een regulier conceptpakket" /></SelectTrigger>
              <SelectContent>
                {conceptPackages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>{pkg.naam} · v{pkg.versie}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!selectedPackage || taxonomyLoading || profilesLoading}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Bestand controleren
          </Button>
        </div>

        {conceptPackages.length === 0 && (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            Maak eerst een regulier conceptbronpakket aan. Een goedgekeurd, gearchiveerd of systeembeheerd pakket kan niet worden geïmporteerd.
          </div>
        )}

        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Veiligheidsgrens:</span> import is append-only. Een bestaande code,
          dubbele bestandsregel of eerder geïmporteerd bestand blokkeert de volledige transactie. Import past nooit automatisch een waarde op een scenario toe.
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-medium"><History className="h-3.5 w-3.5" /> Recente imports</p>
          {runsLoading && <p className="text-xs text-muted-foreground">Importhistorie laden…</p>}
          {!runsLoading && runs.length === 0 && <p className="text-xs text-muted-foreground">Nog geen gecontroleerde imports uitgevoerd.</p>}
          {runs.slice(0, 5).map((run) => (
            <div key={run.id} className="flex flex-col gap-1 rounded-md border px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{run.bestand_naam}{run.werkblad ? ` · ${run.werkblad}` : ''}</p>
                <p className="text-muted-foreground">{packageNames.get(run.bronpakket_id) ?? 'Onbekend pakket'} · {formatDateTime(run.created_at)}</p>
              </div>
              <Badge variant="outline">{run.geimporteerd_aantal} regels</Badge>
            </div>
          ))}
        </div>
      </CardContent>

      {selectedPackage && (
        <SourceImportDialog
          open={open}
          onOpenChange={setOpen}
          pkg={selectedPackage}
          existingCodes={entries.map((entry) => entry.code)}
          taxonomyOptions={options}
          mappingProfiles={profiles}
          onSaveMappingProfile={saveProfile}
          onArchiveMappingProfile={archiveProfile}
          onImport={async (args) => {
            const result = await importPreview(args);
            if (!result) return false;
            await refetchPackages();
            return true;
          }}
        />
      )}
    </Card>
  );
}

function SourceImportDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: VastgoedrekenenSourcePackage;
  existingCodes: string[];
  taxonomyOptions: ReturnType<typeof useControlledTaxonomy>['options'];
  mappingProfiles: SourceImportMappingProfile[];
  onSaveMappingProfile: (draft: SourceImportMappingProfileDraft) => Promise<SourceImportMappingProfile | null>;
  onArchiveMappingProfile: (profile: SourceImportMappingProfile) => Promise<boolean>;
  onImport: (args: Parameters<ReturnType<typeof useSourcePackageImport>['importPreview']>[0]) => Promise<boolean>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedSourceImportFile | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [mapping, setMapping] = useState<SourceImportColumnMapping>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('__auto__');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileSourceName, setProfileSourceName] = useState(props.pkg.bron_naam);
  const [savingProfile, setSavingProfile] = useState(false);

  const sheet = parsed?.sheets.find((item) => item.name === sheetName) ?? parsed?.sheets[0] ?? null;
  const selectedProfile = props.mappingProfiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const requiredFields = useMemo(() => requiredSourceImportFields().map((item) => item.field), []);
  const mappedIndices = Object.values(mapping).filter((value): value is number => value !== undefined);
  const hasDuplicateMappedColumns = new Set(mappedIndices).size !== mappedIndices.length;
  const canSaveMappingProfile = Boolean(
    sheet
    && requiredFields.every((field) => mapping[field] !== undefined)
    && !hasDuplicateMappedColumns,
  );
  const preview = useMemo(() => sheet ? validateSourceImport({
    sheet,
    mapping,
    pkg: props.pkg,
    existingCodes: props.existingCodes,
    taxonomyOptions: props.taxonomyOptions,
  }) : null, [sheet, mapping, props.pkg, props.existingCodes, props.taxonomyOptions]);

  function reset() {
    setParsed(null);
    setSheetName('');
    setMapping({});
    setFileError(null);
    setConfirmed(false);
    setImporting(false);
    setSelectedProfileId('__auto__');
    setProfileMessage(null);
    setProfileEditorOpen(false);
    setProfileName('');
    setProfileSourceName(props.pkg.bron_naam);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    props.onOpenChange(open);
  }

  function applyAutomaticMapping(nextSheet: NonNullable<typeof sheet>) {
    setMapping(suggestSourceImportMapping(nextSheet.headers));
    setSelectedProfileId('__auto__');
    setProfileMessage('Kolommen zijn opnieuw automatisch herkend. Controleer iedere koppeling.');
    setConfirmed(false);
  }

  function applyProfile(profile: SourceImportMappingProfile, nextSheet: NonNullable<typeof sheet>, automatic = false) {
    const applied = applySourceImportMappingProfile(profile, nextSheet.headers);
    setMapping(applied.mapping);
    setSelectedProfileId(profile.id);
    setConfirmed(false);
    setProfileMessage(
      applied.missingFields.length === 0
        ? `${profile.naam} ${automatic ? 'automatisch ' : ''}toegepast: ${applied.matchedFields.length} kolommen gekoppeld.`
        : `${profile.naam} gedeeltelijk toegepast: ${applied.matchedFields.length} gekoppeld en ${applied.missingFields.length} bronkolommen niet gevonden.`,
    );
  }

  async function readFile(file: File | null) {
    if (!file) return;
    setReading(true);
    setFileError(null);
    setConfirmed(false);
    try {
      const result = await parseSourceImportFile(file);
      const firstSheet = result.sheets[0];
      const exactProfile = bestSourceImportMappingProfile(props.mappingProfiles, firstSheet.headers, props.pkg.bron_naam);
      setParsed(result);
      setSheetName(firstSheet.name);
      if (exactProfile) applyProfile(exactProfile, firstSheet, true);
      else applyAutomaticMapping(firstSheet);
    } catch (error) {
      reset();
      setFileError(error instanceof Error ? error.message : 'Bestand kon niet worden gelezen.');
    } finally {
      setReading(false);
    }
  }

  function selectSheet(name: string) {
    const next = parsed?.sheets.find((item) => item.name === name);
    setSheetName(name);
    if (next) {
      const exactProfile = bestSourceImportMappingProfile(props.mappingProfiles, next.headers, props.pkg.bron_naam);
      if (exactProfile) applyProfile(exactProfile, next, true);
      else applyAutomaticMapping(next);
    } else {
      setMapping({});
    }
    setConfirmed(false);
  }

  function selectMappingProfile(value: string) {
    if (!sheet) return;
    if (value === '__auto__') {
      applyAutomaticMapping(sheet);
      return;
    }
    const profile = props.mappingProfiles.find((item) => item.id === value);
    if (profile) applyProfile(profile, sheet);
  }

  async function saveCurrentMappingProfile() {
    if (!sheet || !canSaveMappingProfile) return;
    setSavingProfile(true);
    try {
      const saved = await props.onSaveMappingProfile({
        naam: profileName,
        bron_naam: profileSourceName || null,
        kolommen: mappingProfileColumns(mapping, sheet.headers),
      });
      if (!saved) return;
      setSelectedProfileId(saved.id);
      setProfileMessage(`${saved.naam} opgeslagen. Het profiel bewaart alleen kolomnamen, geen kengetalwaarden.`);
      setProfileEditorOpen(false);
      setProfileName('');
    } finally {
      setSavingProfile(false);
    }
  }

  async function archiveSelectedProfile() {
    if (!selectedProfile) return;
    const archived = await props.onArchiveMappingProfile(selectedProfile);
    if (!archived || !sheet) return;
    applyAutomaticMapping(sheet);
  }

  async function submit() {
    if (!parsed || !sheet || !preview?.canImport || !confirmed) return;
    setImporting(true);
    try {
      const success = await props.onImport({
        pkg: props.pkg,
        file: parsed,
        sheetName: sheet.name,
        mapping,
        preview,
      });
      if (success) handleOpenChange(false);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bronbestand controleren — {props.pkg.naam}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-md border bg-muted/20 p-3 text-xs">
            <p><span className="font-medium">Bron:</span> {props.pkg.bron_naam}</p>
            <p><span className="font-medium">Prijspeil:</span> {props.pkg.prijspeildatum ?? 'ontbreekt'} · <span className="font-medium">Geldig t/m:</span> {props.pkg.vervaldatum ?? 'ontbreekt'}</p>
            <p><span className="font-medium">Scope:</span> {props.pkg.geografische_scope ?? 'ontbreekt'} · {props.pkg.meetgrondslag ?? 'grondslag ontbreekt'}</p>
          </div>

          <div className="space-y-1.5">
            <Label>CSV-, XLS- of XLSX-bestand</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => void readFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-[10px] text-muted-foreground">Maximaal {SOURCE_IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB en 1.000 gegevensregels per werkblad. Het bestand wordt lokaal gelezen; alleen bevestigde, genormaliseerde regels worden opgeslagen.</p>
            {reading && <p className="text-xs text-muted-foreground">Bestand lezen en SHA-256-controle maken…</p>}
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>

          {parsed && sheet && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Bestand</Label>
                  <p className="rounded-md border px-3 py-2 text-sm">{parsed.fileName} · {(parsed.fileSize / 1024).toFixed(1)} KB · SHA-256 {parsed.sha256.slice(0, 12)}…</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Werkblad</Label>
                  <Select value={sheet.name} onValueChange={selectSheet}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{parsed.sheets.map((item) => <SelectItem key={item.name} value={item.name}>{item.name} ({item.rows.length})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label>Herbruikbaar kolommappingprofiel</Label>
                    <Select value={selectedProfileId} onValueChange={selectMappingProfile}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">Automatisch herkennen — altijd controleren</SelectItem>
                        {props.mappingProfiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.naam}{profile.bron_naam ? ` · ${profile.bron_naam}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canSaveMappingProfile}
                      onClick={() => {
                        setProfileSourceName(props.pkg.bron_naam);
                        setProfileEditorOpen((current) => !current);
                      }}
                    >
                      <Save className="mr-1 h-3.5 w-3.5" /> Opslaan als profiel
                    </Button>
                    {selectedProfile && !selectedProfile.system_managed && (
                      <Button size="sm" variant="ghost" onClick={() => void archiveSelectedProfile()}>
                        <Archive className="mr-1 h-3.5 w-3.5" /> Archiveren
                      </Button>
                    )}
                  </div>
                </div>
                {profileMessage && <p className="mt-2 text-[11px] text-muted-foreground">{profileMessage}</p>}
                {hasDuplicateMappedColumns && (
                  <p className="mt-2 text-[11px] text-destructive">Eén bronkolom is aan meerdere velden gekoppeld. Herstel dit voordat je de mapping als profiel opslaat.</p>
                )}
                {profileEditorOpen && (
                  <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Profielnaam</Label>
                      <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Bijvoorbeeld: Bouwkostenleverancier standaardexport" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bron of leverancier</Label>
                      <Input value={profileSourceName} onChange={(event) => setProfileSourceName(event.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button size="sm" onClick={() => void saveCurrentMappingProfile()} disabled={!profileName.trim() || savingProfile}>
                        {savingProfile ? 'Profiel opslaan…' : 'Profiel bevestigen'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setProfileEditorOpen(false)}>Annuleren</Button>
                    </div>
                  </div>
                )}
              </div>

              <MappingGrid definitions={requiredSourceImportFields()} headers={sheet.headers} mapping={mapping} setMapping={setMapping} />
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">Optionele kolommen koppelen</summary>
                <div className="mt-3"><MappingGrid definitions={optionalSourceImportFields()} headers={sheet.headers} mapping={mapping} setMapping={setMapping} /></div>
              </details>

              {preview && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-emerald-700">{preview.validCount} geldig</Badge>
                    <Badge variant={preview.errorCount ? 'destructive' : 'outline'}>{preview.errorCount} fouten</Badge>
                    <Badge variant="outline" className={preview.conflictCount ? 'text-amber-700' : ''}>{preview.conflictCount} conflicten</Badge>
                  </div>
                  {preview.globalIssues.map((issue) => <p key={issue} className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{issue}</p>)}

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead className="bg-muted/40 text-left">
                        <tr><th className="p-2">Rij</th><th className="p-2">Status</th><th className="p-2">Code</th><th className="p-2">Naam</th><th className="p-2">Bandbreedte</th><th className="p-2">Controle</th></tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 40).map((row) => (
                          <tr key={row.rowNumber} className="border-t align-top">
                            <td className="p-2">{row.rowNumber}</td>
                            <td className="p-2">{statusBadge(row.status)}</td>
                            <td className="p-2 font-mono-data">{row.normalized?.code ?? row.raw[mapping.code ?? -1] ?? '—'}</td>
                            <td className="p-2">{row.normalized?.naam ?? row.raw[mapping.naam ?? -1] ?? '—'}</td>
                            <td className="p-2">{row.normalized ? `${row.normalized.minimum_waarde} / ${row.normalized.basis_waarde} / ${row.normalized.maximum_waarde}` : '—'}</td>
                            <td className="p-2 text-muted-foreground">{row.issues.length ? row.issues.join(' · ') : 'Alle controles geslaagd.'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.rows.length > 40 && <p className="text-[10px] text-muted-foreground">De tabel toont de eerste 40 van {preview.rows.length} regels. Alle regels zijn wel gevalideerd.</p>}

                  <label className="flex items-start gap-2 rounded-md border p-3 text-xs">
                    <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                    <span>Ik heb het bronpakket, werkblad, de kolomkoppeling, bandbreedten en alle regels gecontroleerd. Ik begrijp dat deze import nieuwe conceptregisterregels toevoegt maar niets op scenario’s toepast.</span>
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuleren</Button>
          <Button onClick={() => void submit()} disabled={!preview?.canImport || !confirmed || importing}>
            {importing ? 'Transactioneel importeren…' : `Importeer ${preview?.validCount ?? 0} regels`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MappingGrid(props: {
  definitions: SourceImportColumnDefinition[];
  headers: string[];
  mapping: SourceImportColumnMapping;
  setMapping: (mapping: SourceImportColumnMapping) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {props.definitions.map((definition) => (
        <div key={definition.field} className="space-y-1.5">
          <Label>{definition.label}{definition.required ? ' *' : ''}</Label>
          <Select
            value={props.mapping[definition.field] === undefined ? '__none__' : String(props.mapping[definition.field])}
            onValueChange={(value) => {
              const next = { ...props.mapping };
              if (value === '__none__') delete next[definition.field];
              else next[definition.field] = Number(value);
              props.setMapping(next);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Niet gekoppeld</SelectItem>
              {props.headers.map((header, index) => <SelectItem key={`${header}-${index}`} value={String(index)}>{header || `Kolom ${index + 1}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
