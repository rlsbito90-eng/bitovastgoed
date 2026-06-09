import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  berekenMatchScore,
  type AssetClass, type LeadStatus, type PartijType, type Relatie, type ObjectVastgoed,
} from '@/data/mock-data';
import { LeadStatusBadge } from '@/components/StatusBadges';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toast } from 'sonner';
import { parseDutchNumber } from '@/lib/format/nl';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  objectId: string;
  /** relatieIds die al gekoppeld zijn (worden uitgesloten) */
  reedsGekoppeld: Set<string>;
  /** Wordt aangeroepen na succesvol toevoegen */
  onToegevoegd?: () => void;
}

const PARTIJ_LABELS: Record<PartijType, string> = {
  belegger: 'Belegger',
  ontwikkelaar: 'Ontwikkelaar',
  eigenaar: 'Eigenaar',
  makelaar: 'Makelaar',
  partner: 'Partner',
  overig: 'Overig',
};

const LEAD_LABELS: Record<LeadStatus, string> = {
  koud: 'Koud', lauw: 'Lauw', warm: 'Warm', actief: 'Actief',
};

type SortKey = 'naam' | 'contact' | 'type' | 'status' | 'plaats' | 'budgetMin' | 'budgetMax' | 'laatsteContact' | 'match';
type SortDir = 'asc' | 'desc';

const fmtBedrag = (n?: number) =>
  n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';
const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM yyyy', { locale: nl }) : '—';

export default function KandidaatSelectieDialog({ open, onOpenChange, objectId, reedsGekoppeld, onToegevoegd }: Props) {
  const {
    relaties, contactpersonen, getObjectById,
    getZoekprofielenByRelatie, addPipelineKandidaat,
  } = useDataStore();

  const object = getObjectById(objectId);

  const [zoek, setZoek] = useState('');
  const [filterType, setFilterType] = useState<PartijType | ''>('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | ''>('');
  const [filterAssetClass, setFilterAssetClass] = useState<AssetClass | ''>('');
  const [filterPlaats, setFilterPlaats] = useState('');
  const [budgetMinFilter, setBudgetMinFilter] = useState('');
  const [budgetMaxFilter, setBudgetMaxFilter] = useState('');
  const [alleenActief, setAlleenActief] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('match');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [bezig, setBezig] = useState(false);
  const zoekRef = useRef<HTMLInputElement>(null);

  // Reset bij open
  useEffect(() => {
    if (open) {
      setZoek(''); setFilterType(''); setFilterStatus(''); setFilterAssetClass('');
      setFilterPlaats(''); setBudgetMinFilter(''); setBudgetMaxFilter('');
      setAlleenActief(false); setGeselecteerd(new Set());
      setSortKey('match'); setSortDir('desc');
    }
  }, [open]);

  // Verrijk relaties met match score + contactpersoon-naam
  const verrijkt = useMemo(() => {
    return relaties
      .filter(r => !reedsGekoppeld.has(r.id))
      .map(r => {
        const cps = contactpersonen.filter(c => c.relatieId === r.id);
        const primair = cps.find(c => c.isPrimair) ?? cps[0];
        const contactNaam = primair?.naam?.trim() || r.contactpersoon?.trim() || '';
        const email = r.email?.trim() || primair?.email?.trim() || '';
        const telefoon = r.telefoon?.trim() || primair?.telefoon?.trim() || primair?.telefoonMobiel?.trim() || '';
        const plaats = r.vestigingsplaats?.trim() || (r.regio?.[0] ?? '');

        const zps = getZoekprofielenByRelatie(r.id);
        const zp = zps.find(z => z.status === 'actief') ?? zps[0];
        let score: number | undefined;
        let zpId: string | undefined;
        if (zp && object) {
          try {
            const res = berekenMatchScore(object as ObjectVastgoed, zp);
            score = res?.score;
            zpId = zp.id;
          } catch { /* ignore */ }
        }

        return {
          relatie: r,
          contactNaam,
          email,
          telefoon,
          plaats,
          alleContacten: cps,
          zoekprofielId: zpId,
          score,
        };
      });
  }, [relaties, contactpersonen, reedsGekoppeld, object, getZoekprofielenByRelatie]);

  // Filter
  const gefilterd = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const plaatsQ = filterPlaats.trim().toLowerCase();
    const minF = parseDutchNumber(budgetMinFilter) ?? undefined;
    const maxF = parseDutchNumber(budgetMaxFilter) ?? undefined;

    return verrijkt.filter(item => {
      const r = item.relatie;

      if (q) {
        const haystack = [
          r.bedrijfsnaam,
          item.contactNaam,
          item.email,
          item.telefoon,
          item.plaats,
          PARTIJ_LABELS[r.type],
          r.notities ?? '',
          r.aankoopcriteria ?? '',
          r.verkoopintentie ?? '',
          ...item.alleContacten.flatMap(c => [c.naam, c.email ?? '', c.telefoon ?? '', c.telefoonMobiel ?? '', c.functie ?? '']),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (filterType && r.type !== filterType) return false;
      if (filterStatus && r.leadStatus !== filterStatus) return false;
      if (filterAssetClass && !(r.assetClasses ?? []).includes(filterAssetClass)) return false;
      if (plaatsQ) {
        const allePlaatsen = [item.plaats, ...(r.regio ?? [])].join(' ').toLowerCase();
        if (!allePlaatsen.includes(plaatsQ)) return false;
      }
      if (alleenActief && !(r.leadStatus === 'warm' || r.leadStatus === 'actief')) return false;

      // Budget overlap: filter wil objecten waar relatie's budget de range raakt
      if (minF != null && (r.budgetMax != null) && r.budgetMax < minF) return false;
      if (maxF != null && (r.budgetMin != null) && r.budgetMin > maxF) return false;

      return true;
    });
  }, [verrijkt, zoek, filterType, filterStatus, filterAssetClass, filterPlaats, budgetMinFilter, budgetMaxFilter, alleenActief]);

  // Sorteer
  const gesorteerd = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = [...gefilterd];
    arr.sort((a, b) => {
      const ra = a.relatie, rb = b.relatie;
      let va: string | number = '', vb: string | number = '';
      switch (sortKey) {
        case 'naam': va = ra.bedrijfsnaam ?? ''; vb = rb.bedrijfsnaam ?? ''; break;
        case 'contact': va = a.contactNaam; vb = b.contactNaam; break;
        case 'type': va = ra.type; vb = rb.type; break;
        case 'status': va = ra.leadStatus; vb = rb.leadStatus; break;
        case 'plaats': va = a.plaats; vb = b.plaats; break;
        case 'budgetMin': va = ra.budgetMin ?? -Infinity; vb = rb.budgetMin ?? -Infinity; break;
        case 'budgetMax': va = ra.budgetMax ?? -Infinity; vb = rb.budgetMax ?? -Infinity; break;
        case 'laatsteContact': va = ra.laatsteContact ?? ''; vb = rb.laatsteContact ?? ''; break;
        case 'match': va = a.score ?? -1; vb = b.score ?? -1; break;
      }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'nl', { sensitivity: 'base' }) * dir;
    });
    return arr;
  }, [gefilterd, sortKey, sortDir]);

  const sorteerToggle = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'match' || k === 'budgetMax' || k === 'laatsteContact' ? 'desc' : 'asc'); }
  };

  const SortKop = ({ k, children, align = 'left' }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <th className={`text-${align} font-medium py-2 px-2 select-none`}>
      <button
        type="button"
        onClick={() => sorteerToggle(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortKey === k
          ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );

  const toggle = (id: string) => setGeselecteerd(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAlles = () => {
    if (geselecteerd.size === gesorteerd.length) setGeselecteerd(new Set());
    else setGeselecteerd(new Set(gesorteerd.map(x => x.relatie.id)));
  };

  const filtersActief = !!(filterType || filterStatus || filterAssetClass || filterPlaats || budgetMinFilter || budgetMaxFilter || alleenActief || zoek);
  const wisFilters = () => {
    setZoek(''); setFilterType(''); setFilterStatus(''); setFilterAssetClass('');
    setFilterPlaats(''); setBudgetMinFilter(''); setBudgetMaxFilter(''); setAlleenActief(false);
  };

  const handleToevoegen = async () => {
    if (geselecteerd.size === 0 || !object) return;
    setBezig(true);
    let ok = 0, fout = 0;
    for (const id of geselecteerd) {
      const item = verrijkt.find(v => v.relatie.id === id);
      try {
        await addPipelineKandidaat({
          objectId,
          relatieId: id,
          zoekprofielId: item?.zoekprofielId,
          pipelineFase: 'match_gevonden',
          interesseNiveau: 'lauw',
          matchscore: item?.score,
          teaserVerstuurd: false,
          ndaVerstuurd: false,
          ndaGetekend: false,
          informatieGedeeld: false,
          feeAkkoord: false,
        });
        ok++;
      } catch {
        fout++;
      }
    }
    setBezig(false);
    if (ok > 0) {
      toast.success(`${ok} kandida${ok === 1 ? 'at' : 'ten'} toegevoegd`);
      onToegevoegd?.();
      onOpenChange(false);
    }
    if (fout > 0) toast.error(`${fout} kandida${fout === 1 ? 'at' : 'ten'} niet toegevoegd`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle>Kandidaat toevoegen</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Selecteer één of meerdere relaties om als kandidaat aan dit object te koppelen.
            {reedsGekoppeld.size > 0 && ` ${reedsGekoppeld.size} relatie${reedsGekoppeld.size === 1 ? '' : 's'} reeds gekoppeld (verborgen).`}
          </p>
        </DialogHeader>

        {/* Zoek + filters */}
        <div className="px-5 py-3 border-b border-border bg-muted/20 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={zoekRef}
              placeholder="Zoek op bedrijfsnaam, contactpersoon, e-mail, telefoon, plaats, notities…"
              value={zoek}
              onChange={e => setZoek(e.target.value)}
              className="pl-8 pr-9 h-9"
              autoFocus
            />
            {zoek && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setZoek('');
                  zoekRef.current?.focus();
                }}
                aria-label="Zoekterm wissen"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as PartijType | '')}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Alle types</option>
              {(Object.keys(PARTIJ_LABELS) as PartijType[]).map(t => (
                <option key={t} value={t}>{PARTIJ_LABELS[t]}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as LeadStatus | '')}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Alle statussen</option>
              {(Object.keys(LEAD_LABELS) as LeadStatus[]).map(s => (
                <option key={s} value={s}>{LEAD_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={filterAssetClass}
              onChange={e => setFilterAssetClass(e.target.value as AssetClass | '')}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Alle assetclasses</option>
              {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map(a => (
                <option key={a} value={a}>{ASSET_CLASS_LABELS[a]}</option>
              ))}
            </select>
            <Input
              placeholder="Plaats / regio"
              value={filterPlaats}
              onChange={e => setFilterPlaats(e.target.value)}
              className="h-9 text-xs"
            />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Budget vanaf €"
              value={budgetMinFilter}
              onChange={e => setBudgetMinFilter(e.target.value)}
              className="h-9 text-xs"
            />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Budget tot €"
              value={budgetMaxFilter}
              onChange={e => setBudgetMaxFilter(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={alleenActief} onCheckedChange={v => setAlleenActief(!!v)} />
              <span>Alleen warm/actief</span>
            </label>
            <button
              type="button"
              onClick={toggleAlles}
              disabled={gesorteerd.length === 0}
              className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-40"
            >
              {geselecteerd.size === gesorteerd.length && gesorteerd.length > 0 ? 'Deselecteer alles' : 'Selecteer alles'}
            </button>
            <span className="text-muted-foreground">
              {gesorteerd.length} gevonden · {geselecteerd.size} geselecteerd
            </span>
            {filtersActief && (
              <button
                type="button"
                onClick={wisFilters}
                className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Wis filters
              </button>
            )}
          </div>
        </div>

        {/* Lijst */}
        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {gesorteerd.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">
              {filtersActief ? 'Geen relaties voldoen aan de criteria.' : 'Geen beschikbare relaties.'}
            </div>
          ) : (
            <>
              {/* Desktop: tabel */}
              <table className="hidden md:table w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30 sticky top-0 z-10">
                  <tr>
                    <th className="w-10 py-2 px-2"></th>
                    <SortKop k="naam">Bedrijfsnaam</SortKop>
                    <SortKop k="contact">Contactpersoon</SortKop>
                    <th className="text-left font-medium py-2 px-2">E-mail</th>
                    <th className="text-left font-medium py-2 px-2">Telefoon</th>
                    <SortKop k="type">Type</SortKop>
                    <SortKop k="status">Status</SortKop>
                    <SortKop k="plaats">Plaats</SortKop>
                    <th className="text-left font-medium py-2 px-2">Assetclass</th>
                    <SortKop k="budgetMin" align="right">Budget vanaf</SortKop>
                    <SortKop k="budgetMax" align="right">Budget tot</SortKop>
                    <SortKop k="laatsteContact">Laatste contact</SortKop>
                    <th className="text-left font-medium py-2 px-2">Bron</th>
                    <SortKop k="match" align="right">Match</SortKop>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {gesorteerd.map(item => {
                    const r = item.relatie;
                    const checked = geselecteerd.has(r.id);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => toggle(r.id)}
                        className={`cursor-pointer hover:bg-muted/40 ${checked ? 'bg-accent/10' : ''}`}
                      >
                        <td className="py-2 px-2"><Checkbox checked={checked} onCheckedChange={() => toggle(r.id)} /></td>
                        <td className="py-2 px-2 font-medium max-w-[180px] truncate" title={r.bedrijfsnaam}>{r.bedrijfsnaam || '—'}</td>
                        <td className="py-2 px-2 max-w-[160px] truncate" title={item.contactNaam}>{item.contactNaam || '—'}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground max-w-[180px] truncate" title={item.email}>{item.email || '—'}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{item.telefoon || '—'}</td>
                        <td className="py-2 px-2 text-xs whitespace-nowrap">{PARTIJ_LABELS[r.type]}</td>
                        <td className="py-2 px-2"><LeadStatusBadge status={r.leadStatus} /></td>
                        <td className="py-2 px-2 text-xs max-w-[120px] truncate" title={item.plaats}>{item.plaats || '—'}</td>
                        <td className="py-2 px-2 text-xs max-w-[160px] truncate" title={(r.assetClasses ?? []).map(a => ASSET_CLASS_LABELS[a]).join(', ')}>
                          {(r.assetClasses ?? []).slice(0, 2).map(a => ASSET_CLASS_LABELS[a]).join(', ') || '—'}
                          {(r.assetClasses?.length ?? 0) > 2 && <span className="text-muted-foreground"> +{(r.assetClasses!.length - 2)}</span>}
                        </td>
                        <td className="py-2 px-2 text-right font-mono-data text-xs whitespace-nowrap">{fmtBedrag(r.budgetMin)}</td>
                        <td className="py-2 px-2 text-right font-mono-data text-xs whitespace-nowrap">{fmtBedrag(r.budgetMax)}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDatum(r.laatsteContact)}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground max-w-[100px] truncate" title={r.bronRelatie ?? ''}>{r.bronRelatie || '—'}</td>
                        <td className="py-2 px-2 text-right font-mono-data text-xs">{item.score != null ? `${item.score}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobiel: kaartlijst */}
              <div className="md:hidden divide-y divide-border/60">
                {gesorteerd.map(item => {
                  const r = item.relatie;
                  const checked = geselecteerd.has(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 ${checked ? 'bg-accent/10' : ''}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(r.id)} className="mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm truncate">{getRelatieDropdownLabel(r, contactpersonen)}</div>
                          <LeadStatusBadge status={r.leadStatus} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {PARTIJ_LABELS[r.type]}{item.plaats ? ` · ${item.plaats}` : ''}
                        </div>
                        {(item.email || item.telefoon) && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.email}{item.email && item.telefoon ? ' · ' : ''}{item.telefoon}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono-data">
                          Budget: {fmtBedrag(r.budgetMin)} – {fmtBedrag(r.budgetMax)}
                          {item.score != null && <span className="ml-2">Match: {item.score}%</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border bg-card shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>Annuleren</Button>
          <Button onClick={handleToevoegen} disabled={geselecteerd.size === 0 || bezig}>
            {bezig ? 'Bezig…' : `Toevoegen${geselecteerd.size > 0 ? ` (${geselecteerd.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
