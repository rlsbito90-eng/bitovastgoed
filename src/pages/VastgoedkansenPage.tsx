import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CheckSquare2, Database, MapPin, Pencil, PlayCircle, Plus, Radar, RotateCcw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { HERKOMST_LABEL, PRIORITEIT_LABEL, STATUS_LABEL, STATUS_VOLGORDE, kansTitel, type Vastgoedkans, type VastgoedkansStatus } from '@/lib/vastgoedkansen';
import { leesVastgoedkansWerkcontext } from '@/lib/vastgoedkansWorkspace';
import { VASTGOEDKANS_STATUS_PRESENTATIE, vastgoedkansStatusChipClass, vastgoedkansStatusRowClass } from '@/lib/vastgoedkansStatusPresentation';
import VastgoedkansFormDialog from '@/components/forms/VastgoedkansFormDialog';

type Werkbak = VastgoedkansStatus | 'alles' | 'archief';

export default function VastgoedkansenPage() {
  const { kansen, archief, laden, archiveKansen, restoreKansen } = useVastgoedkansen();
  const [werkbak, setWerkbakState] = useState<Werkbak>('te_beoordelen');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ open: boolean; kans: Vastgoedkans | null }>({ open: false, kans: null });
  const [selectieModus, setSelectieModus] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [bevestigActie, setBevestigActie] = useState<'archiveren' | 'heropenen' | null>(null);
  const [bulkBezig, setBulkBezig] = useState(false);
  const hervat = useMemo(() => leesVastgoedkansWerkcontext(), [kansen.length]);
  const hervatKans = hervat ? kansen.find((kans) => kans.id === hervat.kansId) : null;

  const setWerkbak = (volgende: Werkbak) => {
    setWerkbakState(volgende);
    setGeselecteerd(new Set());
  };

  const counts = useMemo(() => Object.fromEntries(STATUS_VOLGORDE.map((status) => [status, kansen.filter((kans) => kans.status === status).length])), [kansen]);
  const basis = werkbak === 'archief' ? archief : kansen;
  const list = useMemo(() => basis.filter((kans) => {
    if (werkbak !== 'alles' && werkbak !== 'archief' && kans.status !== werkbak) return false;
    if (!q) return true;
    return [kans.korteOmschrijving, kans.adres, kans.postcode, kans.plaats, kans.typeVastgoed, kans.redenInteressant, kans.eigenaarNaam].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase());
  }), [basis, werkbak, q]);

  const alleZichtbaarGeselecteerd = list.length > 0 && list.every((kans) => geselecteerd.has(kans.id));
  const toggleKans = (id: string) => setGeselecteerd((vorig) => {
    const volgende = new Set(vorig);
    if (volgende.has(id)) volgende.delete(id); else volgende.add(id);
    return volgende;
  });
  const toggleAlles = () => setGeselecteerd(alleZichtbaarGeselecteerd ? new Set() : new Set(list.map((kans) => kans.id)));
  const stopSelecteren = () => { setSelectieModus(false); setGeselecteerd(new Set()); };

  const voerBulkActieUit = async () => {
    const ids = [...geselecteerd];
    if (!bevestigActie || ids.length === 0) return;
    setBulkBezig(true);
    try {
      if (bevestigActie === 'archiveren') {
        await archiveKansen(ids);
        toast.success(`${ids.length} vastgoedkans${ids.length === 1 ? '' : 'en'} gearchiveerd.`);
      } else {
        await restoreKansen(ids);
        toast.success(`${ids.length} vastgoedkans${ids.length === 1 ? '' : 'en'} heropend.`);
      }
      setGeselecteerd(new Set());
      setBevestigActie(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulkactie mislukt.');
    } finally {
      setBulkBezig(false);
    }
  };

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <PageHeader title="Vastgoedkansen" subtitle="Compacte acquisitiewerkbank vóór een pand een CRM-Object wordt." actions={<div className="flex flex-wrap gap-2"><Button variant={selectieModus ? 'secondary' : 'outline'} onClick={() => selectieModus ? stopSelecteren() : setSelectieModus(true)}>{selectieModus ? <X className="mr-1.5 h-4 w-4" /> : <CheckSquare2 className="mr-1.5 h-4 w-4" />}{selectieModus ? 'Stop selecteren' : 'Selecteren'}</Button><Button variant="outline" onClick={() => setForm({ open: true, kans: null })}><Plus className="mr-1.5 h-4 w-4" />Nieuwe kans</Button><Button asChild><Link to="/vastgoedkansen/vinden"><Radar className="mr-1.5 h-4 w-4" />Panden vinden</Link></Button></div>} />

    {hervatKans && werkbak !== 'archief' && <section className="section-card border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-primary">Verder waar je gebleven was</p><p className="mt-1 truncate text-sm font-medium">{kansTitel(hervatKans)}</p><p className="mt-1 text-xs text-muted-foreground">{STATUS_LABEL[hervatKans.status]} · {hervat?.tab === 'kadaster' ? 'Kadaster & eigenaar' : hervat?.tab === 'brieven' ? 'Brieven & opvolging' : hervat?.tab === 'dossier' ? 'Dossier' : 'Overzicht'}</p></div>
        <Button asChild><Link to={`/vastgoedkansen/${hervatKans.id}`}><PlayCircle className="mr-1.5 h-4 w-4" />Doorgaan</Link></Button>
      </div>
    </section>}

    <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
      {STATUS_VOLGORDE.map((status) => <button key={status} onClick={() => setWerkbak(status)} className={vastgoedkansStatusChipClass(status, werkbak === status)}>{STATUS_LABEL[status]} <span className="ml-1 opacity-70">{counts[status]}</span></button>)}
      <button onClick={() => setWerkbak('alles')} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${werkbak === 'alles' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}>Alles {kansen.length}</button>
      <button onClick={() => setWerkbak('archief')} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${werkbak === 'archief' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}><Archive className="mr-1 inline h-3.5 w-3.5" />Archief {archief.length}</button>
    </div>

    <div className="relative max-w-xl min-w-0"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="min-w-0 pl-9" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Zoek adres, plaats, type, eigenaar of reden…" /></div>

    {selectieModus && <section className="section-card flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
      <div className="flex items-center gap-3"><Checkbox checked={alleZichtbaarGeselecteerd} onCheckedChange={toggleAlles} aria-label="Selecteer alle zichtbare vastgoedkansen" /><div><p className="text-sm font-medium">{geselecteerd.size} geselecteerd</p><p className="text-xs text-muted-foreground">{list.length} zichtbaar in deze werkbak</p></div></div>
      <div className="flex flex-wrap gap-2">{werkbak === 'archief' ? <Button variant="outline" disabled={geselecteerd.size === 0} onClick={() => setBevestigActie('heropenen')}><RotateCcw className="mr-1.5 h-4 w-4" />Heropenen</Button> : <Button variant="outline" disabled={geselecteerd.size === 0} onClick={() => setBevestigActie('archiveren')}><Archive className="mr-1.5 h-4 w-4" />Archiveren</Button>}</div>
    </section>}

    <section className="section-card min-w-0 overflow-hidden">
      {laden ? <p className="p-8 text-sm text-muted-foreground">Laden…</p> : list.length === 0 ? <div className="p-10 text-center"><Database className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm text-muted-foreground">{werkbak === 'archief' ? 'Geen gearchiveerde vastgoedkansen.' : 'Geen vastgoedkansen in deze werkbak.'}</p></div> : <div className="divide-y divide-border/70">
        {list.map((kans) => <div key={kans.id} className={`flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5 ${vastgoedkansStatusRowClass(kans.status)}`}>{selectieModus && <Checkbox className="mt-1 shrink-0" checked={geselecteerd.has(kans.id)} onCheckedChange={() => toggleKans(kans.id)} aria-label={`Selecteer ${kansTitel(kans)}`} />}<div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><Link to={`/vastgoedkansen/${kans.id}`} className="min-w-0 break-words text-sm font-medium hover:text-primary hover:underline">{kansTitel(kans)}</Link>{kans.kansnummer && <span className="text-[11px] font-mono-data text-muted-foreground">{kans.kansnummer}</span>}<Badge variant="outline" className={VASTGOEDKANS_STATUS_PRESENTATIE[kans.status].chip}>{STATUS_LABEL[kans.status]}</Badge><Badge variant="outline">{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</Badge>{kans.algoritmeScore != null && <Badge variant="secondary">Score {kans.algoritmeScore}</Badge>}{werkbak === 'archief' && <Badge variant="secondary">Gearchiveerd</Badge>}</div>{kans.korteOmschrijving && <p className="mt-0.5 text-xs text-muted-foreground">{[kans.adres, kans.postcode, kans.plaats].filter(Boolean).join(', ')}</p>}<p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground"><span>{kans.typeVastgoed || 'Type onbekend'}</span><span>· {HERKOMST_LABEL[kans.herkomst]}</span><span>· Eigenaar: {kans.eigenaarStatus.replace('_', ' ')}</span><span>· Brief: {kans.briefStatus.replace('_', ' ')}</span></p>{werkbak === 'archief' && kans.archivedAt && <p className="mt-1 text-xs text-muted-foreground">Gearchiveerd {new Date(kans.archivedAt).toLocaleDateString('nl-NL')}{kans.archivedReason ? ` · ${kans.archivedReason}` : ''}</p>}{kans.redenInteressant && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{kans.redenInteressant}</p>}</div>{!selectieModus && <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, kans })} aria-label="Bewerken" className="shrink-0"><Pencil className="h-4 w-4" /></Button>}</div>)}
      </div>}
    </section>

    <div className="flex min-w-0 gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><p>Open een kans om snel te werken met tabs, vorige/volgende, Kadaster & eigenaar, brieven & opvolging en dossierverdieping.</p></div>
    <VastgoedkansFormDialog open={form.open} onOpenChange={(open) => setForm({ open, kans: open ? form.kans : null })} kans={form.kans} />

    <AlertDialog open={bevestigActie !== null} onOpenChange={(open) => { if (!open && !bulkBezig) setBevestigActie(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{bevestigActie === 'heropenen' ? 'Vastgoedkansen heropenen?' : 'Vastgoedkansen archiveren?'}</AlertDialogTitle><AlertDialogDescription>{bevestigActie === 'heropenen' ? `${geselecteerd.size} geselecteerde vastgoedkans${geselecteerd.size === 1 ? '' : 'en'} worden teruggezet in de actieve werkvoorraad.` : `${geselecteerd.size} geselecteerde vastgoedkans${geselecteerd.size === 1 ? '' : 'en'} verdwijnen uit de actieve werkvoorraad, maar blijven met historie beschikbaar in Archief.`}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={bulkBezig}>Annuleren</AlertDialogCancel><AlertDialogAction disabled={bulkBezig} onClick={(event) => { event.preventDefault(); void voerBulkActieUit(); }}>{bulkBezig ? 'Bezig…' : bevestigActie === 'heropenen' ? 'Heropenen' : 'Archiveren'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
