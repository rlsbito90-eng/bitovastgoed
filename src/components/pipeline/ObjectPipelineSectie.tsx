import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Pencil, ExternalLink } from 'lucide-react';
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
  const [keuze, setKeuze] = useState('');
  const [bewerken, setBewerken] = useState<PipelineKandidaat | null>(null);

  const beschikbareRelaties = useMemo(() => {
    const gebruikte = new Set(kandidaten.map(k => k.relatieId));
    return relaties.filter(r => !gebruikte.has(r.id));
  }, [relaties, kandidaten]);

  const handleAdd = async () => {
    if (!keuze || !object) return;
    const relatie = relaties.find(r => r.id === keuze);
    if (!relatie) return;

    // Bereken matchscore tegen het eerste actieve zoekprofiel van deze relatie (best effort)
    const zps = getZoekprofielenByRelatie(keuze);
    const zp = zps.find(z => z.status === 'actief') ?? zps[0];
    let score: number | undefined;
    let zpId: string | undefined;
    if (zp) {
      try {
        const res = berekenMatchScore(object as any, zp as any);
        score = res?.score;
        zpId = zp.id;
      } catch {/* fallback: geen score */}
    }

    try {
      await addPipelineKandidaat({
        objectId,
        relatieId: keuze,
        zoekprofielId: zpId,
        pipelineFase: 'match_gevonden',
        interesseNiveau: 'lauw',
        matchscore: score,
        teaserVerstuurd: false,
        ndaVerstuurd: false,
        ndaGetekend: false,
        informatieGedeeld: false,
        feeAkkoord: false,
      });
      toast.success('Kandidaat toegevoegd aan pipeline');
      setKeuze(''); setAdding(false);
    } catch (err: any) {
      toast.error(`Toevoegen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
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

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
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
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={keuze}
            onChange={e => setKeuze(e.target.value)}
          >
            <option value="">— Kies relatie —</option>
            {beschikbareRelaties.map(r => (
              <option key={r.id} value={r.id}>{r.bedrijfsnaam || '(geen naam)'}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAdd} disabled={!keuze}>Toevoegen</Button>
            <Button type="button" variant="outline" onClick={() => { setAdding(false); setKeuze(''); }}>Annuleer</Button>
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
