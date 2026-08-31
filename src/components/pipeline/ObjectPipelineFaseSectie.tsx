// Toont en beheert de centrale Object-lifecycle op ObjectDetailPage.
// - Objectstatus = beschikbaarheid van het object, direct wijzigbaar zonder edit-formulier
// - Trajectfase = commerciële voortgang in de Object Pipeline
// - Feeprognose = Objectniveau totdat een concrete Deal bestaat
// - Deal fee supersedes Object forecast in rapportage; nooit dubbel tellen

import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { useObjectFeeForecast } from '@/hooks/useObjectFeeForecast';
import type { ObjectVastgoed, ObjectStatus } from '@/data/mock-data';
import { OBJECT_STATUS_LABELS, formatCurrency } from '@/data/mock-data';
import { Lock, Unlock, ExternalLink, GitBranch, Building2, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/ui/number-field';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useEffect, useState } from 'react';

interface Props {
  object: ObjectVastgoed;
}

const BESCHIKBAARHEIDSSTATUSSEN: ObjectStatus[] = [
  'beschikbaar',
  'on_hold',
  'onder_optie',
  'verkocht',
  'ingetrokken',
];

export default function ObjectPipelineFaseSectie({ object }: Props) {
  const {
    getDefaultObjectPipeline, getStagesVoorPipeline,
    setObjectPipelineStage, updateObject, unarchiveObject, getDealsByObject,
  } = useDataStore();

  const [bezig, setBezig] = useState(false);
  const [statusBezig, setStatusBezig] = useState(false);
  const pipeline = getDefaultObjectPipeline();
  const stages = pipeline ? getStagesVoorPipeline(pipeline.id) : [];
  const statusIsLegacy = !BESCHIKBAARHEIDSSTATUSSEN.includes(object.status);
  const statusSelectValue = statusIsLegacy ? '' : object.status;

  const {
    forecast,
    setForecast,
    loading: feeLoading,
    saving: feeSaving,
    save: saveFeeForecast,
  } = useObjectFeeForecast(object.id);
  const [feeDirty, setFeeDirty] = useState(false);

  useEffect(() => {
    setFeeDirty(false);
  }, [object.id, forecast.percentage, forecast.bedrag, forecast.structuur]);

  const transactionDeals = getDealsByObject(object.id).filter(d => !d.isArchived && !d.softDeletedAt);
  const heeftConcreteDeal = transactionDeals.length > 0;

  const wijzigStatus = async (nieuweStatus: ObjectStatus) => {
    if (!nieuweStatus || nieuweStatus === object.status) return;

    const isEindstatus = nieuweStatus === 'verkocht' || nieuweStatus === 'ingetrokken';
    if (isEindstatus) {
      const label = OBJECT_STATUS_LABELS[nieuweStatus];
      const extra = nieuweStatus === 'verkocht'
        ? ' Een gekoppelde transactie-Deal wordt waar mogelijk automatisch als gewonnen afgerond; overige actieve Deals als verloren.'
        : ' Eventuele actieve Deals worden automatisch als verloren afgesloten.';
      const akkoord = window.confirm(
        `Objectstatus wijzigen naar “${label}”? Het object wordt daarmee ook gearchiveerd.${extra}`,
      );
      if (!akkoord) return;
    }

    setStatusBezig(true);
    try {
      await updateObject(object.id, { status: nieuweStatus });

      // Een eerder gearchiveerd object dat bewust terug naar een actieve
      // beschikbaarheidsstatus gaat, moet ook daadwerkelijk weer actief worden.
      if (object.isArchived && !isEindstatus) {
        await unarchiveObject(object.id);
      }

      toast.success(`Objectstatus gewijzigd naar ${OBJECT_STATUS_LABELS[nieuweStatus]}`);
    } catch (err: any) {
      toast.error(`Objectstatus bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setStatusBezig(false);
    }
  };

  const statusSelect = (
    <select
      className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
      value={statusSelectValue}
      disabled={statusBezig}
      onChange={e => wijzigStatus(e.target.value as ObjectStatus)}
    >
      {statusIsLegacy && (
        <option value="" disabled>
          {OBJECT_STATUS_LABELS[object.status]} — legacy, kies nieuwe status
        </option>
      )}
      {BESCHIKBAARHEIDSSTATUSSEN.map(status => (
        <option key={status} value={status}>{OBJECT_STATUS_LABELS[status]}</option>
      ))}
    </select>
  );

  const saveFee = async () => {
    try {
      await saveFeeForecast(forecast);
      setFeeDirty(false);
      toast.success('Feeprognose opgeslagen');
    } catch (err: any) {
      toast.error(`Feeprognose opslaan mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const setFeePct = (percentage?: number) => {
    const next = { ...forecast, percentage };
    if (percentage != null && object.vraagprijs != null) {
      next.bedrag = Math.round(object.vraagprijs * (percentage / 100));
    }
    setForecast(next);
    setFeeDirty(true);
  };

  const feeSection = (
    <div className="border-t border-border/50 pt-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="section-title flex items-center gap-2">
            <Coins className="h-4 w-4" /> Feeprognose
          </h2>
          <p className="text-xs text-muted-foreground">
            Verwachte fee op Objectniveau zolang er nog geen concrete transactie-Deal bestaat.
          </p>
        </div>
        {heeftConcreteDeal && (
          <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            Deal fee is nu leidend
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="field-label block mb-1.5">Verwachte fee (%)</label>
          <NumberField
            decimals={2}
            value={forecast.percentage}
            disabled={feeLoading || feeSaving}
            onChange={setFeePct}
            placeholder="bv. 1,5"
          />
        </div>
        <div>
          <label className="field-label block mb-1.5">Verwachte fee (€)</label>
          <NumberField
            value={forecast.bedrag}
            disabled={feeLoading || feeSaving}
            onChange={bedrag => {
              setForecast({ ...forecast, bedrag });
              setFeeDirty(true);
            }}
            placeholder="bv. 15.000"
          />
        </div>
        <div>
          <label className="field-label block mb-1.5">Fee-structuur</label>
          <Input
            value={forecast.structuur ?? ''}
            disabled={feeLoading || feeSaving}
            onChange={e => {
              setForecast({ ...forecast, structuur: e.target.value || undefined });
              setFeeDirty(true);
            }}
            placeholder="bv. 1% koper, success fee"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-muted-foreground">
          {heeftConcreteDeal
            ? `Objectprognose ${forecast.bedrag != null ? formatCurrency(forecast.bedrag) : '—'} blijft zichtbaar als referentie, maar telt niet meer mee zodra een Deal bestaat.`
            : 'Rapportage gebruikt deze Objectfee als prognose. Zodra een Deal ontstaat, neemt uitsluitend de Deal fee het over.'}
        </p>
        <Button type="button" size="sm" onClick={saveFee} disabled={!feeDirty || feeSaving || feeLoading}>
          {feeSaving ? 'Opslaan…' : 'Feeprognose opslaan'}
        </Button>
      </div>
    </div>
  );

  if (!pipeline || stages.length === 0) {
    return (
      <section className="section-card p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="section-title flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Beschikbaarheid
          </h2>
          <p className="text-xs text-muted-foreground">
            Objectstatus staat los van de commerciële trajectfase.
          </p>
        </div>
        {statusSelect}
        {statusIsLegacy && (
          <p className="text-[11px] text-warning">
            Dit object gebruikt nog een oude processtatus. Er wordt niets automatisch geconverteerd; kies bewust een beschikbaarheidsstatus.
          </p>
        )}
        <p className="text-sm text-muted-foreground">Geen actieve Object Pipeline geconfigureerd.</p>
        {feeSection}
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
      toast.success('Trajectfase bijgewerkt en handmatig vastgezet');
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
    <section className="section-card p-5 sm:p-6 space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-3 md:pr-5 md:border-r md:border-border/60">
          <div className="space-y-1">
            <h2 className="section-title flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Beschikbaarheid
            </h2>
            <p className="text-xs text-muted-foreground">
              Staat los van Dealflow en kan hier direct worden gewijzigd.
            </p>
          </div>

          <div>
            <label className="field-label block mb-1.5">Objectstatus</label>
            {statusSelect}
          </div>

          {statusIsLegacy && (
            <p className="text-[11px] text-warning">
              Huidige waarde is een oude processtatus. Kies bewust een nieuwe beschikbaarheidsstatus; er vindt geen stille conversie plaats.
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Verkocht en Ingetrokken archiveren het object automatisch. Terugzetten naar een actieve status activeert het object weer.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h2 className="section-title flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> Trajectfase
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
        </div>
      </div>

      {feeSection}

      <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-3">
        Handmatig wijzigen van de trajectfase vergrendelt alleen de commerciële voortgang. De Objectstatus blijft een afzonderlijke beschikbaarheidsstatus.
      </p>
    </section>
  );
}
