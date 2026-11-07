// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AandachtItem } from '@/lib/dashboard/aandacht';
import { localDateKey } from '@/lib/tasks/workView';

const create = vi.fn(async () => 'taak-1');
const plan = vi.fn(async () => undefined);
const refresh = vi.fn(async () => undefined);
vi.mock('@/lib/tasks/reminders', () => ({ createManualTaskWithReminder: (...a: unknown[]) => create(...(a as [])) }));
vi.mock('@/lib/tasks/planning', () => ({ updateTaskPlanning: (...a: unknown[]) => plan(...(a as [])) }));
vi.mock('@/hooks/useDataStore', () => ({ useDataStore: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OpvolgingPlannenDialog from './OpvolgingPlannenDialog';

const item: AandachtItem = {
  objectId: 'obj-1', titel: 'Object A', signaal: 'geen_kandidaat', label: 'Geen kandidaat',
  toelichting: '', volgendeActie: 'kandidaten zoeken', extraSignalen: 0, overigeSignalen: [], dagenStil: 3,
};

describe('OpvolgingPlannenDialog', () => {
  beforeEach(() => { create.mockClear(); plan.mockClear(); refresh.mockClear(); });

  it('legt standaard een plandatum vandaag vast en géén harde deadline', async () => {
    const onGepland = vi.fn();
    const onOpenChange = vi.fn();
    render(<OpvolgingPlannenDialog item={item} onOpenChange={onOpenChange} onGepland={onGepland} />);
    expect((screen.getByLabelText('Taak') as HTMLInputElement).value).toBe('Kandidaten zoeken');
    fireEvent.click(screen.getByRole('button', { name: 'Plannen' }));
    const vandaag = localDateKey(new Date());
    await waitFor(() => expect(onGepland).toHaveBeenCalledWith('taak-1', vandaag));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ titel: 'Kandidaten zoeken', objectId: 'obj-1', deadline: undefined }));
    expect(plan).toHaveBeenCalledWith('taak-1', { planDatum: vandaag, planTijd: null, planningBucket: 'open' });
    expect(refresh).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('een harde deadline alleen als die expliciet is toegevoegd', async () => {
    render(<OpvolgingPlannenDialog item={item} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Harde deadline toevoegen'));
    fireEvent.change(screen.getByLabelText('Harde deadline'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plannen' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ deadline: '2026-12-01' })));
  });
});
