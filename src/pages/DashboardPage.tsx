import { useEffect, useMemo, useState } from 'react';
import TaskRow from '@/components/tasks/TaskRow';
import TaakAfrondenDialog from '@/components/forms/TaakAfrondenDialog';
import DashboardKengetallen from '@/components/dashboard/DashboardKengetallen';
import DashboardWerklijst from '@/components/dashboard/DashboardWerklijst';
import DashboardAandacht from '@/components/dashboard/DashboardAandacht';
import OpvolgingPlannenDialog from '@/components/dashboard/OpvolgingPlannenDialog';
import { useBiedingen } from '@/hooks/useBiedingen';
import { bepaalAandacht, type AandachtItem } from '@/lib/dashboard/aandacht';
import { useTaskRowActions } from '@/hooks/useTaskRowActions';
import { berekenAanbodvolume } from '@/lib/dashboard/aanbodvolume';
import { useDataStore } from '@/hooks/useDataStore';
import { useUnifiedFeeReporting } from '@/hooks/useUnifiedFeeReporting';
import {
  getAllMatchesFromData,
  berekenCommissieStats,
} from '@/data/mock-data';
import type { Taak } from '@/data/mock-data';
import PageHeader from '@/components/PageHeader';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import {
  listTaskPlanning,
  taskPlanningMap,
  type TaskPlanningMeta,
} from '@/lib/tasks/planning';
import {
  groupTodayWork,
  localDateKey,
  planningForTask,
} from '@/lib/tasks/workView';




/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const store = useDataStore();
  const { objecten, deals, taken } = store;
  const nu = new Date();
  const unifiedFees = useUnifiedFeeReporting(nu.getFullYear());
  const [planningRows, setPlanningRows] = useState<TaskPlanningMeta[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listTaskPlanning()
      .then(rows => { if (!cancelled) setPlanningRows(rows); })
      .catch(error => console.error('Dashboard taakplanning laden mislukt', error));
    return () => { cancelled = true; };
  }, [taken.length]);

  const planningById = useMemo(() => taskPlanningMap(planningRows), [planningRows]);
  const planningFor = (task: Taak) => planningForTask(task, planningById);
  const werklijst = useMemo(() => groupTodayWork(taken, planningFor, nu), [taken, planningRows]);
  const { actions: taakActies, afrondenTaak, setAfrondenTaak } = useTaskRowActions({
    planningFor,
    setPlanningRows,
    returnTo: { path: '/', label: 'Dashboard', source: 'dashboard-werklijst' },
  });
  const vandaagKey = localDateKey(nu);
  const renderWerklijstTaak = (task: Taak) => {
    const rel = task.relatieId ? store.getRelatieById(task.relatieId) : null;
    const deal = task.dealId ? store.getDealById(task.dealId) : null;
    const obj = task.objectId ? store.getObjectById(task.objectId) : (deal ? store.getObjectById(deal.objectId) : null);
    return (
      <TaskRow
        key={task.id}
        task={task}
        planning={planningFor(task)}
        now={nu}
        today={vandaagKey}
        relatie={rel ?? null}
        relatieNaam={rel ? getRelatieNaamCompact(rel, store.contactpersonen) : null}
        object={obj ?? null}
        deal={deal ?? null}
        actions={taakActies}
      />
    );
  };

  const actieveObjecten = useMemo(() => objecten.filter(o => !o.isArchived), [objecten]);
  const aanbodvolume = useMemo(() => berekenAanbodvolume(actieveObjecten), [actieveObjecten]);

  const matches = useMemo(() => getAllMatchesFromData(store.zoekprofielen, store.objecten), [store.zoekprofielen, store.objecten]);

  const biedingen = useBiedingen({ all: true });
  const [opvolgingVoor, setOpvolgingVoor] = useState<AandachtItem | null>(null);
  const aandacht = useMemo(() => bepaalAandacht({
    objecten,
    kandidaten: store.pipelineKandidaten,
    biedingen: biedingen.items,
    contactMoments: store.contactMoments,
    taken,
    deals,
    matches,
    aantalZoekprofielen: store.zoekprofielen.filter(z => z.status === 'actief').length,
    planDatumVoor: taak => planningById.get(taak.id)?.planDatum ?? null,
    relatieNaam: id => {
      const rel = store.getRelatieById(id);
      return rel ? getRelatieNaamCompact(rel, store.contactpersonen) : null;
    },
  }, nu), [store.relaties, store.contactpersonen, objecten, store.pipelineKandidaten, biedingen.items, store.contactMoments, taken, deals, matches, store.zoekprofielen, planningById, vandaagKey]);

  const commissieStats = useMemo(
    () => berekenCommissieStats(deals, (oid) => store.getObjectById(oid)?.vraagprijs, nu.getFullYear()),
    [deals, store, nu],
  );

  const dashboardPipelineFee = unifiedFees.error
    ? commissieStats.pipelineBedragTotaal
    : unifiedFees.stats.pipelineBedrag;


  const feeByObject = new Map(unifiedFees.rows.map(row => [row.objectId, row.pipelineFee]));
  const objectenZonderFee = unifiedFees.error || unifiedFees.loading
    ? null
    : actieveObjecten.filter(object => !((feeByObject.get(object.id) ?? 0) > 0)).length;

  return (
    <div className="page-shell-wide">
      <PageHeader
        title="Dashboard"
        subtitle={<span className="capitalize">{nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
      />

      <DashboardKengetallen
        aanbodvolume={aanbodvolume}
        courtage={dashboardPipelineFee}
        objectenZonderFee={objectenZonderFee}
        actieveObjecten={actieveObjecten.length}
        achterstallig={werklijst.achterstallig.length}
      />

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-2 items-start">
        <DashboardWerklijst groups={werklijst} renderTask={renderWerklijstTaak} />
        <DashboardAandacht
          overzicht={aandacht}
          status={biedingen.loading ? 'laden' : biedingen.error ? 'fout' : 'klaar'}
          onPlanOpvolging={setOpvolgingVoor}
        />
      </div>

      <OpvolgingPlannenDialog
        item={opvolgingVoor}
        onOpenChange={value => { if (!value) setOpvolgingVoor(null); }}
        onGepland={(id, planDatum) => setPlanningRows(rows => [
          ...rows.filter(row => row.id !== id),
          { id, planDatum, planTijd: null, planningBucket: 'open' },
        ])}
      />
      <TaakAfrondenDialog open={!!afrondenTaak} onOpenChange={value => { if (!value) setAfrondenTaak(null); }} taak={afrondenTaak} />
    </div>
  );
}
