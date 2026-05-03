// src/components/forms/RelatieHerstelImportDialog.tsx
//
// TIJDELIJKE hersteltool voor een foutieve bulk-import van Relaties.
// - Toont recent aangemaakte (niet-soft-deleted) relaties
// - Filter: vandaag / 24u / 7 dagen
// - Checkbox-selectie (niets standaard geselecteerd)
// - Knop "Selecteer vermoedelijke laatste import" — clustert relaties die
//   binnen 5 minuten van de meest recente created_at zijn aangemaakt
// - Verwijdert pas na bevestigingstekst "VERWIJDER IMPORT"
// - Gebruikt soft delete via useDataStore.deleteRelatie
// - Raakt GEEN gekoppelde taken/objecten/matches/notities aan,
//   maar toont wél een telling als er gekoppelde records zijn

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useDataStore } from '@/hooks/useDataStore';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Periode = 'vandaag' | '24u' | '7d';

interface RecentRelatie {
  id: string;
  bedrijfsnaam: string | null;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  type_partij: string | null;
  lead_status: string | null;
  created_at: string;
  gekoppeldeTaken: number;
  gekoppeldeDeals: number;
  gekoppeldeNotities: number;
  gekoppeldeObjecten: number;
}

const periodeStart = (p: Periode): Date => {
  const d = new Date();
  if (p === 'vandaag') {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (p === '24u') return new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
};

export default function RelatieHerstelImportDialog({ open, onOpenChange }: Props) {
  const { deleteRelatie } = useDataStore();
  const [periode, setPeriode] = useState<Periode>('24u');
  const [rows, setRows] = useState<RecentRelatie[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectie, setSelectie] = useState<Set<string>>(new Set());
  const [bevestigingsOpen, setBevestigingsOpen] = useState(false);
  const [bevestigingsTekst, setBevestigingsTekst] = useState('');
  const [bezig, setBezig] = useState(false);

  // -------- LADEN --------
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSelectie(new Set());
      try {
        const since = periodeStart(periode).toISOString();
        const { data, error } = await supabase
          .from('relaties')
          .select('id, bedrijfsnaam, contactpersoon, email, telefoon, type_partij, lead_status, created_at')
          .is('soft_deleted_at', null)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        const ids = (data ?? []).map(r => r.id);

        // Tellingen van gekoppelde records — alleen ter waarschuwing
        const [takenRes, dealsRes, notitiesRes, objectenRes] = ids.length
          ? await Promise.all([
              supabase.from('taken').select('id, relatie_id').in('relatie_id', ids).is('soft_deleted_at', null),
              supabase.from('deals').select('id, relatie_id').in('relatie_id', ids).is('soft_deleted_at', null),
              supabase.from('notities').select('id, relatie_id').in('relatie_id', ids),
              supabase.from('objecten').select('id, eigenaar_relatie_id').in('eigenaar_relatie_id', ids).is('soft_deleted_at', null),
            ])
          : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];

        const tel = (arr: any[] | null | undefined, key: string) => {
          const m = new Map<string, number>();
          (arr ?? []).forEach(x => {
            const k = x[key];
            if (k) m.set(k, (m.get(k) ?? 0) + 1);
          });
          return m;
        };
        const tT = tel(takenRes.data, 'relatie_id');
        const tD = tel(dealsRes.data, 'relatie_id');
        const tN = tel(notitiesRes.data, 'relatie_id');
        const tO = tel(objectenRes.data, 'eigenaar_relatie_id');

        if (cancelled) return;
        setRows(
          (data ?? []).map(r => ({
            ...r,
            gekoppeldeTaken: tT.get(r.id) ?? 0,
            gekoppeldeDeals: tD.get(r.id) ?? 0,
            gekoppeldeNotities: tN.get(r.id) ?? 0,
            gekoppeldeObjecten: tO.get(r.id) ?? 0,
          })),
        );
      } catch (e: any) {
        console.error(e);
        toast.error('Kon recente relaties niet laden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, periode]);

  // -------- SELECTIE --------
  const toggleOne = (id: string) => {
    setSelectie(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelectie(prev => (prev.size === rows.length ? new Set() : new Set(rows.map(r => r.id))));
  };

  const selecteerVermoedelijkeImport = () => {
    if (rows.length === 0) {
      toast.info('Geen recente relaties gevonden');
      return;
    }
    // Cluster: alle relaties binnen 5 minuten van de meest recente created_at
    const sorted = [...rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const top = new Date(sorted[0].created_at).getTime();
    const window = 5 * 60 * 1000;
    const cluster = sorted.filter(r => top - new Date(r.created_at).getTime() <= window);
    setSelectie(new Set(cluster.map(r => r.id)));
    toast.success(`${cluster.length} relaties geselecteerd (binnen 5 min van laatste import)`);
  };

  // -------- VERWIJDEREN --------
  const geselecteerdeRows = useMemo(
    () => rows.filter(r => selectie.has(r.id)),
    [rows, selectie],
  );
  const totaalKoppelingen = useMemo(
    () =>
      geselecteerdeRows.reduce(
        (s, r) =>
          s + r.gekoppeldeTaken + r.gekoppeldeDeals + r.gekoppeldeNotities + r.gekoppeldeObjecten,
        0,
      ),
    [geselecteerdeRows],
  );

  const verwijder = async () => {
    if (bevestigingsTekst.trim() !== 'VERWIJDER IMPORT') {
      toast.error('Bevestigingstekst klopt niet');
      return;
    }
    setBezig(true);
    let ok = 0;
    let fout = 0;
    for (const r of geselecteerdeRows) {
      try {
        await deleteRelatie(r.id);
        ok++;
      } catch {
        fout++;
      }
    }
    setBezig(false);
    setBevestigingsOpen(false);
    setBevestigingsTekst('');
    if (fout === 0) {
      toast.success(`${ok} relaties verwijderd (soft delete)`);
    } else {
      toast.warning(`${ok} verwijderd, ${fout} mislukt`);
    }
    // Refresh lijst
    setRows(prev => prev.filter(r => !selectie.has(r.id)));
    setSelectie(new Set());
  };

  // -------- RENDER --------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Foutieve import herstellen</DialogTitle>
          <DialogDescription>
            Tijdelijke tool om recent geïmporteerde relaties veilig te verwijderen (soft delete).
            Bestaande relaties buiten je selectie blijven onaangetast.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <span className="text-sm text-muted-foreground mr-2">Periode:</span>
          {(['vandaag', '24u', '7d'] as Periode[]).map(p => (
            <Button
              key={p}
              size="sm"
              variant={periode === p ? 'default' : 'outline'}
              onClick={() => setPeriode(p)}
            >
              {p === 'vandaag' ? 'Vandaag' : p === '24u' ? 'Laatste 24 uur' : 'Laatste 7 dagen'}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={selecteerVermoedelijkeImport} disabled={loading || rows.length === 0}>
              Selecteer vermoedelijke laatste import
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={selectie.size === 0}
              onClick={() => setBevestigingsOpen(true)}
            >
              Verwijder selectie ({selectie.size})
            </Button>
          </div>
        </div>

        {/* Lijst */}
        <div className="flex-1 overflow-auto border border-border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Laden…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Geen relaties gevonden in deze periode.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectie.size > 0 && selectie.size === rows.length}
                      onCheckedChange={toggleAll}
                      aria-label="Selecteer alles"
                    />
                  </TableHead>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Contactpersoon</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead>Koppelingen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const koppel = r.gekoppeldeTaken + r.gekoppeldeDeals + r.gekoppeldeNotities + r.gekoppeldeObjecten;
                  return (
                    <TableRow key={r.id} data-state={selectie.has(r.id) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox checked={selectie.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{r.bedrijfsnaam || '—'}</TableCell>
                      <TableCell>{r.contactpersoon || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{r.email || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{r.telefoon || '—'}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.type_partij || '—'}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.lead_status || '—'}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('nl-NL')}
                      </TableCell>
                      <TableCell>
                        {koppel > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {koppel}
                            <span className="text-muted-foreground">
                              {' '}
                              (T:{r.gekoppeldeTaken} D:{r.gekoppeldeDeals} N:{r.gekoppeldeNotities} O:{r.gekoppeldeObjecten})
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {rows.length} relaties getoond · {selectie.size} geselecteerd. Soft delete — herstel mogelijk via database.
        </p>
      </DialogContent>

      {/* Bevestigingsdialoog */}
      <Dialog open={bevestigingsOpen} onOpenChange={(o) => { if (!bezig) setBevestigingsOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bevestig verwijderen</DialogTitle>
            <DialogDescription>
              Je staat op het punt <strong>{geselecteerdeRows.length}</strong> relatie(s) te verwijderen
              (soft delete).
            </DialogDescription>
          </DialogHeader>

          {totaalKoppelingen > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Let op: er zijn {totaalKoppelingen} gekoppelde records.</p>
                  <p className="text-xs mt-1">
                    Gekoppelde taken, deals, notities en objecten worden <strong>NIET</strong> verwijderd
                    en blijven verwijzen naar deze relaties. Verwijder die handmatig indien gewenst.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">
              Typ <code className="px-1 py-0.5 bg-muted rounded">VERWIJDER IMPORT</code> ter bevestiging
            </label>
            <Input
              className="mt-2"
              value={bevestigingsTekst}
              onChange={e => setBevestigingsTekst(e.target.value)}
              placeholder="VERWIJDER IMPORT"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBevestigingsOpen(false)} disabled={bezig}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={verwijder}
              disabled={bezig || bevestigingsTekst.trim() !== 'VERWIJDER IMPORT'}
            >
              {bezig && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Definitief verwijderen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
