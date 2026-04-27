import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, ExternalLink, Search } from 'lucide-react';
import { PipelineFaseBadge, InteresseNiveauBadge, FASE_LABEL } from './PipelineBadges';
import PipelineKandidaatDialog from './PipelineKandidaatDialog';
import { VOLGENDE_ACTIE_LABELS, type PipelineKandidaat, berekenMatchScore } from '@/data/mock-data';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface Props { objectId: string; }

const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM yyyy', { locale: nl }) : '—';
const fmtBedrag = (n?: number) => n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';

export default function ObjectPipelineSectie({ objectId }: Props) {
  const {
    relaties, getObjectById, getPipelineVoorObject,
    addPipelineKandidaat, removePipelineKandidaat, getZoekprofielenByRelatie,
  } = useDataStore();

  const object = getObjectById(objectId);
  const kandidaten = getPipelineVoorObject(objectId);
  const [adding, setAdding] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [zoek, setZoek] = useState('');
  const [bezig, setBezig] = useState(false);
  const [bewerken, setBewerken] = useState<PipelineKandidaat | null>(null);

  const alleBeschikbaar = useMemo(() => {
    const gebruikte = new Set(kandidaten.map(k => k.relatieId));
    const lijst = relaties.filter(r => !gebruikte.has(r.id));

    return lijst.map(r => {
      const zps = getZoekprofielenByRelatie(r.id);
      const zp = zps.find(z => z.status === 'actief') ?? zps[0];
      let score: number | undefined;
      let zpId: string | undefined;
      if (zp && object) {
        try {
          const res = berekenMatchScore(object as any, zp as any);
          score = res?.score;
          zpId = zp.id;
        } catch {/* geen score */}
      }
      return { relatie: r, score, zoekprofielId: zpId };
    });
  }, [relaties, kandidaten, object, getZoekprofielenByRelatie]);

  const beschikbareRelaties = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const gefilterd = q
      ? alleBeschikbaar.filter(({ relatie: r }) =>
          (r.bedrijfsnaam || '').toLowerCase().includes(q) ||
          (r.contactpersoon || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q),
        )
      : alleBeschikbaar;

    return [...gefilterd].sort((a, b) => {
      const sa = a.score ?? -1;
      const sb = b.score ?? -1;
      if (sb !== sa) return sb - sa;
      return (a.relatie.bedrijfsnaam || '').localeCompare(b.relatie.bedrijfsnaam || '');
    });
  }, [alleBeschikbaar, zoek]);

  const toggleSelectie = (id: string) => {
    setGeselecteerd(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAlles = () => {
    if (geselecteerd.size === beschikbareRelaties.length) {
      setGeselecteerd(new Set());
    } else {
      setGeselecteerd(new Set(beschikbareRelaties.map(r => r.relatie.id)));
    }
  };

  const sluitToevoegen = () => {
    setAdding(false);
    setGeselecteerd(new Set());
    setZoek('');
  };

  const handleAddBulk = async () => {
    if (geselecteerd.size === 0 || !object) return;
    setBezig(true);
    let ok = 0, fout = 0;
    for (const relatieId of geselecteerd) {
      const item = beschikbareRelaties.find(b => b.relatie.id === relatieId);
      try {
        await addPipelineKandidaat({
          objectId,
          relatieId,
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
    if (ok > 0) toast.success(`${ok} kandida${ok === 1 ? 'at' : 'ten'} toegevoegd`);
    if (fout > 0) toast.error(`${fout} kandida${fout === 1 ? 'at' : 'ten'} niet toegevoegd`);
    sluitToevoegen();
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Kandidaat uit pipeline verwijderen?')) return;
    try {
      await removePipelineKandidaat(id);
      toast.success('Verwijderd');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  // Op desktop mag deze kaart de rechterkolomruimte benutten, maar nooit naar links
  // onder het vaste menu schuiven. Daarom vergroten we uitsluitend naar rechts.
  return (
    <section className="section-card p-5 sm:p-6 space-y-4 lg:-mr-[calc(50%+0.75rem)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Kandidaten / dealtraject</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kandidaten.length === 0 ? 'Nog geen kandidaten in de pipeline.' : `${kandidaten.length} kandida${kandidaten.length === 1 ? 'at' : 'ten'} in pipeline`}
          </p>
        </div>
        {!adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={beschikbareRelaties.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Kandidaat toevoegen
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op bedrijfsnaam, contact of e-mail…"
                value={zoek}
                onChange={e => setZoek(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={toggleAlles}
                className="hover:text-foreground underline-offset-2 hover:underline"
                disabled={beschikbareRelaties.length === 0}
              >
                {geselecteerd.size === beschikbareRelaties.length && beschikbareRelaties.length > 0 ? 'Deselecteer alles' : 'Selecteer alles'}
              </button>
              <span>{geselecteerd.size} geselecteerd</span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-background divide-y divide-border/60">
            {beschikbareRelaties.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {zoek ? 'Geen resultaten.' : 'Geen beschikbare relaties.'}
              </div>
            ) : beschikbareRelaties.map(({ relatie: r, score }) => {
              const checked = geselecteerd.has(r.id);
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleSelectie(r.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.bedrijfsnaam || '(geen naam)'}</div>
                    {(r.contactpersoon || r.email) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {[r.contactpersoon, r.email].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-mono-data text-muted-foreground w-12 text-right">
                    {score != null ? `${score}%` : '—'}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={sluitToevoegen} disabled={bezig}>Annuleer</Button>
            <Button type="button" onClick={handleAddBulk} disabled={geselecteerd.size === 0 || bezig}>
              {bezig ? 'Bezig…' : `Toevoegen${geselecteerd.size > 0 ? ` (${geselecteerd.size})` : ''}`}
            </Button>
          </div>
        </div>
      )}

      {kandidaten.length > 0 && (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left font-medium py-2 px-2">Relatie</th>
                <th className="text-left font-medium py-2 px-2">Fase</th>
                <th className="text-left font-medium py-2 px-2">Interesse</th>
                <th className="text-right font-medium py-2 px-2">Match</th>
                <th className="text-right font-medium py-2 px-2">Bieding</th>
                <th className="text-left font-medium py-2 px-2">Volgende actie</th>
                <th className="text-left font-medium py-2 px-2">Laatste contact</th>
                <th className="text-right font-medium py-2 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {kandidaten.map(k => {
                const rel = relaties.find(r => r.id === k.relatieId);
                return (
                  <tr key={k.id} className="hover:bg-muted/30">
                    <td className="py-2 px-2">
                      <Link to={`/relaties/${k.relatieId}`} className="font-medium hover:text-primary inline-flex items-center gap-1">
                        {rel?.bedrijfsnaam ?? '(verwijderd)'}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    </td>
                    <td className="py-2 px-2"><PipelineFaseBadge fase={k.pipelineFase} /></td>
                    <td className="py-2 px-2"><InteresseNiveauBadge niveau={k.interesseNiveau} /></td>
                    <td className="py-2 px-2 text-right font-mono-data text-xs">
                      {k.matchscore != null ? `${k.matchscore}%` : '—'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono-data text-xs">{fmtBedrag(k.biedingBedrag)}</td>
                    <td className="py-2 px-2 text-xs">
                      {k.volgendeActie ? (
                        <span>
                          <span className="font-medium">{VOLGENDE_ACTIE_LABELS[k.volgendeActie]}</span>
                          {k.volgendeActieDatum && <span className="text-muted-foreground"> · {fmtDatum(k.volgendeActieDatum)}</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{fmtDatum(k.laatsteContactdatum)}</td>
                    <td className="py-2 px-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setBewerken(k)} className="h-8 w-8 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(k.id)} className="h-8 w-8 p-0 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {bewerken && (
        <PipelineKandidaatDialog
          open={!!bewerken}
          onOpenChange={(o) => { if (!o) setBewerken(null); }}
          kandidaat={bewerken}
        />
      )}
    </section>
  );
}
