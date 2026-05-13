import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { PipelineFaseBadge, InteresseNiveauBadge } from './PipelineBadges';
import PipelineKandidaatDialog from './PipelineKandidaatDialog';
import KandidaatSelectieDialog from './KandidaatSelectieDialog';
import { VOLGENDE_ACTIE_LABELS, type PipelineKandidaat } from '@/data/mock-data';
import { toast } from 'sonner';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface Props { objectId: string; }

const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM yyyy', { locale: nl }) : '—';
const fmtBedrag = (n?: number) => n != null ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';

export default function ObjectPipelineSectie({ objectId }: Props) {
  const {
    relaties, contactpersonen, getPipelineVoorObject, removePipelineKandidaat,
  } = useDataStore();

  const kandidaten = getPipelineVoorObject(objectId);
  const [adding, setAdding] = useState(false);
  const [bewerken, setBewerken] = useState<PipelineKandidaat | null>(null);

  const reedsGekoppeld = useMemo(
    () => new Set(kandidaten.map(k => k.relatieId)),
    [kandidaten],
  );

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
    <section className="section-card relative z-10 p-5 sm:p-6 space-y-4 min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="section-title">Kandidaten / dealtraject</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kandidaten.length === 0 ? 'Nog geen kandidaten in de pipeline.' : `${kandidaten.length} kandida${kandidaten.length === 1 ? 'at' : 'ten'} in pipeline`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={relaties.length === reedsGekoppeld.size}>
          <Plus className="h-4 w-4 mr-1" /> Kandidaat toevoegen
        </Button>
      </div>

      <KandidaatSelectieDialog
        open={adding}
        onOpenChange={setAdding}
        objectId={objectId}
        reedsGekoppeld={reedsGekoppeld}
      />

      {kandidaten.length > 0 && (
        <div className="overflow-x-auto lg:overflow-visible -mx-2 lg:mx-0">
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
                        {rel ? getRelatieDropdownLabel(rel, contactpersonen) : '(verwijderd)'}
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
