import type React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, Clock, MoreHorizontal, ExternalLink, CheckSquare, Square, Trash2,
} from 'lucide-react';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { Taak } from '@/data/mock-data';
import { isTaakTeLaat, deadlineLabel } from '@/lib/taakHelpers';
import type { TaskPlanningBucket, TaskPlanningMeta } from '@/lib/tasks/planning';
import { isTaskRolledOver, planDateLabel, taskSourceLabel } from '@/lib/tasks/workView';

/**
 * Acties op een taakrij. De aanroeper (Taken, later ook Dashboard) levert de implementatie,
 * zodat beide schermen dezelfde logica en meldingen gebruiken.
 */
export interface TaskRowActions {
  openTask: (task: Taak) => void;
  toggleComplete: (event: React.MouseEvent, task: Taak) => void;
  setWaiting: (event: React.MouseEvent, task: Taak) => void;
  planAfterDays: (event: React.MouseEvent, task: Taak, days: number) => void;
  updatePlanning: (
    event: React.MouseEvent,
    task: Taak,
    patch: { planDatum?: string | null; planningBucket?: TaskPlanningBucket },
    message: string,
  ) => void;
  editTask: (task: Taak) => void;
  requestDelete: (task: Taak) => void;
}

export interface TaskRowProps {
  task: Taak;
  planning: TaskPlanningMeta;
  now: Date;
  /** Lokale datum van vandaag als YYYY-MM-DD. */
  today: string;
  relatie: { id: string } | null;
  relatieNaam: string | null;
  object: { id: string; titel?: string } | null;
  deal: { id: string } | null;
  actions: TaskRowActions;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (taskId: string) => void;
}

export default function TaskRow({
  task, planning, now, today, relatie: rel, relatieNaam, object: obj, deal, actions,
  selectionMode = false, selected = false, onToggleSelection,
}: TaskRowProps) {
  const overdue = isTaakTeLaat(task, now);
  const completed = task.status === 'afgerond';
  const cancelled = task.status === 'geannuleerd';
  const waiting = task.status === 'wacht_op_reactie';
  const context: string[] = [];
  if (rel) context.push(relatieNaam ?? '');
  if (obj?.titel) context.push(obj.titel);

  const planningLabel = planning.planningBucket === 'inbox'
    ? 'Inbox'
    : planning.planningBucket === 'later'
      ? 'Later'
      : planning.planDatum
        ? planDateLabel(planning.planDatum, today, isTaskRolledOver(task, planning, now))
        : !task.deadline ? 'Openstaand' : null;

  const toggleSelection = () => onToggleSelection?.(task.id);

  return (
    <div
      data-testid="taken-lijstregel"
      onClick={() => selectionMode ? toggleSelection() : actions.openTask(task)}
      className={`group px-4 sm:px-5 py-3.5 grid grid-cols-[auto,minmax(0,1fr)] gap-x-3 gap-y-2 sm:flex sm:items-center transition-colors cursor-pointer ${selected ? 'bg-accent/8' : 'hover:bg-muted/30'}`}
    >
      <button
        onClick={(event) => { event.stopPropagation(); selectionMode ? toggleSelection() : actions.toggleComplete(event, task); }}
        className="col-start-1 row-start-1 shrink-0 mt-0.5 sm:mt-0 text-muted-foreground hover:text-accent transition-colors"
        aria-label={selectionMode ? (selected ? 'Deselecteren' : 'Selecteren') : (completed ? 'Heropenen' : 'Afronden')}
      >
        {selectionMode
          ? selected ? <CheckSquare className="h-5 w-5 text-accent" /> : <Square className="h-5 w-5" />
          : completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : waiting ? <Clock className="h-5 w-5 text-warning" /> : <Circle className="h-5 w-5" />}
      </button>

      <div className="col-start-2 row-start-1 min-w-0 flex-1">
        <p className={`text-sm font-medium break-words ${completed || cancelled ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.titel}</p>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground/80">{taskSourceLabel(task)}</span>
          {context.map((item, index) => <span key={index} className="flex min-w-0 items-center gap-1.5"><span aria-hidden>·</span><span className="truncate max-w-[220px] sm:max-w-[320px]">{item}</span></span>)}
          {task.type && <><span aria-hidden>·</span><span>{task.type}</span></>}
          {planningLabel && <><span aria-hidden>·</span><span>{planningLabel}</span></>}
          {task.deadline && <><span aria-hidden>·</span><span className={overdue ? 'text-destructive font-medium' : ''}>Deadline {deadlineLabel(task, now)}{overdue ? ' · te laat' : ''}</span></>}
          {task.notities && <><span aria-hidden>·</span><span className="truncate max-w-[240px] opacity-80">{task.notities}</span></>}
        </div>
      </div>

      <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:shrink-0">
        <PrioriteitBadge prioriteit={task.prioriteit} />
        {!completed && <TaakStatusBadge status={task.status} />}
        {!selectionMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={event => event.stopPropagation()}>
              <button className="ml-auto sm:ml-0 opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-muted transition" aria-label="Acties"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={event => event.stopPropagation()}>
              <DropdownMenuLabel>Snelle acties</DropdownMenuLabel>
              <DropdownMenuItem onClick={event => { event.stopPropagation(); actions.editTask(task); }}><MoreHorizontal className="h-4 w-4 mr-2" /> Bewerken</DropdownMenuItem>
              <DropdownMenuSeparator />
              {!completed && <>
                <DropdownMenuItem onClick={event => actions.toggleComplete(event as any, task)}><CheckCircle2 className="h-4 w-4 mr-2" /> Afronden</DropdownMenuItem>
                {!waiting && <DropdownMenuItem onClick={event => actions.setWaiting(event as any, task)}><Clock className="h-4 w-4 mr-2" /> Op wachten zetten</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Planning</DropdownMenuLabel>
                <DropdownMenuItem onClick={event => actions.planAfterDays(event as any, task, 0)}>Vandaag</DropdownMenuItem>
                <DropdownMenuItem onClick={event => actions.planAfterDays(event as any, task, 1)}>Morgen</DropdownMenuItem>
                <DropdownMenuItem onClick={event => actions.planAfterDays(event as any, task, 7)}>Over een week</DropdownMenuItem>
                <DropdownMenuItem onClick={event => actions.updatePlanning(event as any, task, { planningBucket: 'open', planDatum: null }, 'Verplaatst naar Openstaand')}>Openstaand</DropdownMenuItem>
                <DropdownMenuItem onClick={event => actions.updatePlanning(event as any, task, { planningBucket: 'inbox', planDatum: null }, 'Verplaatst naar Inbox')}>Inbox</DropdownMenuItem>
                <DropdownMenuItem onClick={event => actions.updatePlanning(event as any, task, { planningBucket: 'later', planDatum: null }, 'Verplaatst naar Later')}>Later</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>}
              {rel && <DropdownMenuItem asChild><Link to={`/relaties/${rel.id}`} onClick={event => event.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open relatie</Link></DropdownMenuItem>}
              {obj && <DropdownMenuItem asChild><Link to={`/objecten/${obj.id}`} onClick={event => event.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open object</Link></DropdownMenuItem>}
              {deal && <DropdownMenuItem asChild><Link to={`/deals/${deal.id}`} onClick={event => event.stopPropagation()}><ExternalLink className="h-4 w-4 mr-2" /> Open deal</Link></DropdownMenuItem>}
              {(rel || obj || deal) && <DropdownMenuSeparator />}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={event => { event.stopPropagation(); actions.requestDelete(task); }}>
                <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
