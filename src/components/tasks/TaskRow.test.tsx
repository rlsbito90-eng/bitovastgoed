// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Taak } from '@/data/mock-data';
import type { TaskPlanningMeta } from '@/lib/tasks/planning';
import TaskRow, { type TaskRowActions } from './TaskRow';

const now = new Date('2026-11-03T10:00:00');
const today = '2026-11-03';

const taak = (over: Partial<Taak> = {}): Taak =>
  ({ id: 't1', titel: 'Eigenaar bellen', status: 'open', prioriteit: 'normaal', deadline: null, deadlineTijd: null, ...over }) as unknown as Taak;

const plan = (planDatum: string | null): TaskPlanningMeta =>
  ({ id: 't1', planDatum, planTijd: null, planningBucket: 'open' }) as TaskPlanningMeta;

const actions = (): TaskRowActions => ({
  openTask: vi.fn(),
  toggleComplete: vi.fn(),
  setWaiting: vi.fn(),
  planAfterDays: vi.fn(),
  updatePlanning: vi.fn(),
  editTask: vi.fn(),
  requestDelete: vi.fn(),
});

const renderRow = (props: Partial<React.ComponentProps<typeof TaskRow>> = {}) => {
  const a = props.actions ?? actions();
  render(
    <MemoryRouter>
      <TaskRow
        task={taak()}
        planning={plan(null)}
        now={now}
        today={today}
        relatie={null}
        relatieNaam={null}
        object={null}
        deal={null}
        actions={a}
        {...props}
      />
    </MemoryRouter>,
  );
  return a;
};

describe('TaskRow', () => {
  it('toont titel, relatie en object als context', () => {
    renderRow({ relatie: { id: 'r1' }, relatieNaam: 'Bram van Velzen', object: { id: 'o1', titel: 'Horecapand, Roosendaal' } });
    expect(screen.getByText('Eigenaar bellen')).toBeTruthy();
    expect(screen.getByText('Bram van Velzen')).toBeTruthy();
    expect(screen.getByText('Horecapand, Roosendaal')).toBeTruthy();
  });

  it('toont de doorschuifnotatie alleen voor een doorgeschoven taak', () => {
    renderRow({ planning: plan('2026-11-01') });
    expect(screen.getByText('1 nov → vandaag')).toBeTruthy();
  });

  it('toont geen pijl bij een achterstallige taak', () => {
    renderRow({ task: taak({ deadline: '2026-11-02' } as Partial<Taak>), planning: plan('2026-11-01') });
    expect(screen.queryByText('1 nov → vandaag')).toBeNull();
    expect(screen.getByText('Gepland 1 nov')).toBeTruthy();
  });

  it('klik op de rij opent de taak; klik op het rondje rondt af zonder te openen', () => {
    const a = renderRow();
    fireEvent.click(screen.getByText('Eigenaar bellen'));
    expect(a.openTask).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Afronden'));
    expect(a.toggleComplete).toHaveBeenCalledTimes(1);
    expect(a.openTask).toHaveBeenCalledTimes(1);
  });

  it('in selectiemodus selecteert een klik in plaats van openen of afronden', () => {
    const onToggleSelection = vi.fn();
    const a = renderRow({ selectionMode: true, onToggleSelection });
    fireEvent.click(screen.getByText('Eigenaar bellen'));
    fireEvent.click(screen.getByLabelText('Selecteren'));
    expect(onToggleSelection).toHaveBeenCalledTimes(2);
    expect(onToggleSelection).toHaveBeenCalledWith('t1');
    expect(a.openTask).not.toHaveBeenCalled();
    expect(a.toggleComplete).not.toHaveBeenCalled();
  });

  it('TakenPage gebruikt TaskRow in plaats van een eigen rij', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
    expect(page).toContain('<TaskRow');
    expect(page).not.toContain('data-testid="taken-lijstregel"');
  });
});
