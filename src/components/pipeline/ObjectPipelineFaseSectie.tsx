// Toont en beheert de objectpipelinefase op ObjectDetailPage.
// - Huidige fase + kleur
// - Datum laatste fase-update
// - Indicatie of fase handmatig is vastgezet (pipelineStageLocked)
// - Dropdown om fase handmatig te wijzigen (locked = true)
// - Knop "Automatische voortgang weer inschakelen" (locked = false)
// - Link "Bekijk in Pipeline"

import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import type { ObjectVastgoed } from '@/data/mock-data';
import { Lock, Unlock, ExternalLink, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState } from 'react';

interface Props {
  object: ObjectVastgoed;
}

export default function ObjectPipelineFaseSectie({ object }: Props) {
  const {
    getDefaultObjectPipeline, getStagesVoorPipeline,
    setObjectPipelineStage, updateObject,
  } = useDataStore();

  const [bezig, setBezig] = useState(false);
  const pipeline = getDefaultObjectPipeline();
  const stages = pipeline ? getStagesVoorPipeline(pipeline.id) : [];

  if (!pipeline || stages.length === 0) {
    return (
      <section className="section-card p-5 sm:p-6 space-y-3">
        <h2 className="section-title flex items-center gap-2">
          <GitBranch className="h-4 w-4" /> Objectfase
        </h2>
        <p className="text-sm text-muted-foreground">Geen actieve Object Pipeline geconfigureerd.</p>
      </section>
    );
  }

  const huidigeStageId = object.pipelineStageId ?? stages[0]?.id;
  const huidigeStage = stages.find(s => s.id === huidigeStageId);

  const wijzig = async (nieuweStageId: string) => {
    if (!nieuweStageId || nieuweStageId === huidigeStageId) return;
    setBezig(true);
    try {
      await setObjectPipelineStage(object.id, nieuweStageId, { manual: true });
      toast.success('Objectfase bijgewerkt en handmatig vastgezet');
    } catch (err: any) {
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const ontgrendel = async () => {
    setBezig(true);
    try {
      await updateObject(object.id, { pipelineStageLocked: false });
      toast.success('Automatische voortgang weer ingeschakeld');
    } catch (err: any) {
      toast.error(`Ontgrendelen mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="section-title flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Objectfase
          </h2>
          <p className="text-xs text-muted-foreground">
            Pipeline: <span className="font-medium text-foreground">{pipeline.name}</span>
          </p>
        </div>
        <Link
          to="/pipeline"
          className="shrink-0 inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Bekijk in Pipeline <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {huidigeStage ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium border rounded-full"
            style={huidigeStage.color ? { borderColor: huidigeStage.color, color: huidigeStage.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: huidigeStage.color ?? 'currentColor' }}
            />
            {huidigeStage.name}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Geen fase ingesteld</span>
        )}

        {object.pipelineStageLocked ? (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-warning/10 text-warning border border-warning/30 rounded-full">
            <Lock className="h-3 w-3" /> Handmatig vastgezet
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
            <Unlock className="h-3 w-3" /> Automatische voortgang
          </span>
        )}

        {object.pipelineUpdatedAt && (
          <span className="text-xs text-muted-foreground">
            Laatste fase-update: {format(new Date(object.pipelineUpdatedAt), "d MMM yyyy 'om' HH:mm", { locale: nl })}
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label className="field-label block mb-1.5">Fase wijzigen</label>
          <select
            className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
            value={huidigeStageId ?? ''}
            disabled={bezig}
            onChange={e => wijzig(e.target.value)}
          >
            {!huidigeStageId && <option value="">— Kies een fase —</option>}
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        {object.pipelineStageLocked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bezig}
            onClick={ontgrendel}
            className="gap-1.5"
          >
            <Unlock className="h-3.5 w-3.5" />
            Auto. voortgang aan
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Handmatig wijzigen vergrendelt de fase. Automatische voortgang via kandidaten loopt dan niet door —
        gebruik de knop hierboven om dit weer in te schakelen.
      </p>
    </section>
  );
}
