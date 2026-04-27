import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { PipelineFaseBadge, InteresseNiveauBadge } from './PipelineBadges';
import { VOLGENDE_ACTIE_LABELS } from '@/data/mock-data';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Building2 } from 'lucide-react';

const fmtDatum = (d?: string) => d ? format(new Date(d), 'd MMM yyyy', { locale: nl }) : '—';

export default function RelatiePipelineSectie({ relatieId }: { relatieId: string }) {
  const { getPipelineVoorRelatie, getObjectById } = useDataStore();
  const items = getPipelineVoorRelatie(relatieId);

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="section-title">Gekoppelde objecten / pipeline</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {items.length === 0 ? 'Deze relatie staat in geen enkele object-pipeline.' : `${items.length} object${items.length === 1 ? '' : 'en'}`}
        </p>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-border/70 -mx-2">
          {items.map(k => {
            const obj = getObjectById(k.objectId);
            return (
              <li key={k.id} className="px-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/objecten/${k.objectId}`} className="flex-1 min-w-0 group">
                    <div className="flex items-center gap-2 text-sm font-medium group-hover:text-primary truncate">
                      <Building2 className="h-4 w-4 opacity-60 shrink-0" />
                      {obj?.titel ?? '(verwijderd object)'}
                    </div>
                    {obj?.plaats && <p className="text-xs text-muted-foreground ml-6 truncate">{obj.plaats}</p>}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
                    <PipelineFaseBadge fase={k.pipelineFase} />
                    <InteresseNiveauBadge niveau={k.interesseNiveau} />
                  </div>
                </div>
                {(k.volgendeActie || k.laatsteContactdatum) && (
                  <div className="mt-1.5 ml-6 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                    {k.volgendeActie && (
                      <span>
                        <strong className="text-foreground/80">Volgende:</strong> {VOLGENDE_ACTIE_LABELS[k.volgendeActie]}
                        {k.volgendeActieDatum && ` · ${fmtDatum(k.volgendeActieDatum)}`}
                      </span>
                    )}
                    {k.laatsteContactdatum && (
                      <span><strong className="text-foreground/80">Laatste contact:</strong> {fmtDatum(k.laatsteContactdatum)}</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
