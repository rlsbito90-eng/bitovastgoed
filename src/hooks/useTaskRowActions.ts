import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Taak } from '@/data/mock-data';
import { useDataStore } from '@/hooks/useDataStore';
import type { TaskRowActions } from '@/components/tasks/TaskRow';
import { maakCrmReturnState } from '@/lib/crmReturnContext';
import { updateTaskPlanning, type TaskPlanningBucket, type TaskPlanningMeta } from '@/lib/tasks/planning';
import { localDateKey } from '@/lib/tasks/workView';

interface Options {
  planningFor: (task: Taak) => TaskPlanningMeta;
  setPlanningRows: React.Dispatch<React.SetStateAction<TaskPlanningMeta[]>>;
  /** Waar "terug" vanaf de taakdetailpagina naartoe leidt. */
  returnTo: { path: string; label: string; source: string };
}

/**
 * Acties voor TaskRow buiten de Taken-pagina (Dashboard). Zelfde implementatie en meldingen
 * als in TakenPage: afronden via TaakAfrondenDialog, plannen via updateTaskPlanning.
 * Bewerken opent de taakdetailpagina; verwijderen wordt hier niet aangeboden.
 */
export function useTaskRowActions({ planningFor, setPlanningRows, returnTo }: Options) {
  const { updateTaak } = useDataStore();
  const navigate = useNavigate();
  const [afrondenTaak, setAfrondenTaak] = useState<Taak | null>(null);

  const openTask = (task: Taak) =>
    navigate(`/taken/${task.id}`, { state: maakCrmReturnState(returnTo.path, returnTo.label, returnTo.source) });

  const toggleComplete = async (event: React.MouseEvent, task: Taak) => {
    event.stopPropagation();
    if (task.status === 'afgerond') {
      try { await updateTaak(task.id, { status: 'open' }); toast.success('Taak heropend'); }
      catch (error: any) { toast.error(`Bijwerken mislukt: ${error.message ?? 'onbekende fout'}`); }
      return;
    }
    setAfrondenTaak(task);
  };

  const updatePlanning = async (
    event: React.MouseEvent,
    task: Taak,
    patch: { planDatum?: string | null; planningBucket?: TaskPlanningBucket },
    message: string,
  ) => {
    event.stopPropagation();
    try {
      await updateTaskPlanning(task.id, patch);
      setPlanningRows(prev => {
        const current = prev.find(row => row.id === task.id) ?? planningFor(task);
        const next = { ...current, ...patch };
        return prev.some(row => row.id === task.id)
          ? prev.map(row => row.id === task.id ? next : row)
          : [...prev, next];
      });
      toast.success(message);
    } catch (error: any) {
      toast.error(`Planning bijwerken mislukt: ${error.message ?? 'onbekende fout'}`);
    }
  };

  const planAfterDays = (event: React.MouseEvent, task: Taak, days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const label = days === 0 ? 'vandaag' : days === 1 ? 'morgen' : date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    return updatePlanning(event, task, { planningBucket: 'open', planDatum: localDateKey(date) }, `Gepland voor ${label}`);
  };

  const setWaiting = async (event: React.MouseEvent, task: Taak) => {
    event.stopPropagation();
    try { await updateTaak(task.id, { status: 'wacht_op_reactie' }); toast.success('Op wachten gezet'); }
    catch (error: any) { toast.error(`Bijwerken mislukt: ${error.message ?? 'onbekende fout'}`); }
  };

  const actions: TaskRowActions = {
    openTask,
    toggleComplete,
    setWaiting,
    planAfterDays,
    updatePlanning,
    editTask: openTask,
  };

  return { actions, afrondenTaak, setAfrondenTaak };
}
