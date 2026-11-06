import type React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarCheck2, Redo2 } from 'lucide-react';
import type { Taak } from '@/data/mock-data';
import type { TodayWorkGroups } from '@/lib/tasks/workView';
import QuickTaskCapture from '@/components/tasks/QuickTaskCapture';

export const WERKLIJST_MAX_PER_GROEP = 5;

interface Props {
  groups: TodayWorkGroups;
  renderTask: (task: Taak) => React.ReactNode;
}

function Groep({ titel, icon, taken, danger, renderTask }: {
  titel: string;
  icon: React.ReactNode;
  taken: Taak[];
  danger?: boolean;
  renderTask: (task: Taak) => React.ReactNode;
}) {
  if (taken.length === 0) return null;
  const zichtbaar = taken.slice(0, WERKLIJST_MAX_PER_GROEP);
  const rest = taken.length - zichtbaar.length;
  return (
    <div data-testid={`werklijst-groep-${titel.toLowerCase()}`}>
      <div className={`flex items-center justify-between gap-2 px-4 sm:px-5 pt-3 pb-1.5 text-xs font-semibold ${danger ? 'text-destructive' : 'text-muted-foreground'}`}>
        <span className="inline-flex items-center gap-1.5">{icon}{titel}</span>
        <span className="tabular-nums">{taken.length}</span>
      </div>
      <div className="divide-y divide-border/60">{zichtbaar.map(renderTask)}</div>
      {rest > 0 && (
        <Link to="/taken" className="block px-4 sm:px-5 py-2.5 text-xs font-medium text-accent hover:underline">
          Bekijk alle ({taken.length}) in Taken
        </Link>
      )}
    </div>
  );
}

/**
 * Werklijst op het dashboard: achterstallig, doorgeschoven en vandaag, met dezelfde
 * indeling (groupTodayWork) en dezelfde taakrij (TaskRow) als de Taken-module.
 */
export default function DashboardWerklijst({ groups, renderTask }: Props) {
  const { achterstallig, doorgeschoven, vandaag } = groups;
  const voorVandaag = doorgeschoven.length + vandaag.length;
  const leeg = achterstallig.length === 0 && voorVandaag === 0;

  return (
    <section data-testid="dashboard-werklijst" className="section-card overflow-hidden">
      <header className="section-header">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2"><CalendarCheck2 className="h-4 w-4 text-accent" />Mijn werkzaamheden</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span>{`${voorVandaag} voor vandaag`}</span>
            {achterstallig.length > 0 && <> · <span className="text-destructive">{`${achterstallig.length} achterstallig`}</span></>}
          </p>
        </div>
        <Link to="/taken" className="section-link inline-flex items-center gap-1">Alle taken <ArrowRight className="h-3 w-3" /></Link>
      </header>

      {leeg ? (
        <div className="px-4 sm:px-5 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">Niets gepland voor vandaag.</p>
          <QuickTaskCapture defaultTarget="today" />
        </div>
      ) : (
        <div className="pb-1">
          <Groep titel="Achterstallig" icon={<AlertTriangle className="h-3.5 w-3.5" />} taken={achterstallig} danger renderTask={renderTask} />
          <Groep titel="Doorgeschoven" icon={<Redo2 className="h-3.5 w-3.5" />} taken={doorgeschoven} renderTask={renderTask} />
          <Groep titel="Vandaag" icon={<CalendarCheck2 className="h-3.5 w-3.5" />} taken={vandaag} renderTask={renderTask} />
        </div>
      )}
    </section>
  );
}
