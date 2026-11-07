// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AandachtItem } from '@/lib/dashboard/aandacht';
import { localDateKey } from '@/lib/tasks/workView';

const create = vi.fn<(...a: unknown[]) => Promise<string>>(async () => 'taak-1');
const refresh = vi.fn<() => Promise<void>>(async () => undefined);
const toastError = vi.fn();
vi.mock('@/lib/tasks/reminders', () => ({ createManualTaskWithReminder: (...a: unknown[]) => create(...a) }));
vi.mock('@/hooks/useDataStore', () => ({ useDataStore: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import OpvolgingPlannenDialog from './OpvolgingPlannenDialog';

const item: AandachtItem = {
  objectId: 'obj-1', titel: 'Object A', signaal: 'geen_kandidaat', label: 'Geen kandidaat',
  toelichting: '', volgendeActie: 'kandidaten zoeken', extraSignalen: 0, overigeSignalen: [], dagenStil: 3,
};
const plannen = () => fireEvent.click(screen.getByRole('button', { name: 'Plannen' }));

describe('OpvolgingPlannenDialog', () => {
  beforeEach(() => {
    create.mockReset(); create.mockResolvedValue('taak-1');
    refresh.mockReset(); refresh.mockResolvedValue(undefined);
    toastError.mockReset();
  });

  it('slaat taak en plandatum (vandaag) in één keer op, zonder harde deadline', async () => {
    const onGepland = vi.fn();
    const onOpenChange = vi.fn();
    render(<OpvolgingPlannenDialog item={item} onOpenChange={onOpenChange} onGepland={onGepland} />);
    expect((screen.getByLabelText('Taak') as HTMLInputElement).value).toBe('Kandidaten zoeken');
    plannen();
    const vandaag = localDateKey(new Date());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ titel: 'Kandidaten zoeken', objectId: 'obj-1', deadline: undefined }),
      { planDatum: vandaag, planTijd: null, planningBucket: 'open' },
    );
    expect(onGepland).toHaveBeenCalledWith('taak-1', vandaag);
    expect(refresh).toHaveBeenCalled();
  });

  it('een harde deadline alleen als die expliciet is toegevoegd', async () => {
    render(<OpvolgingPlannenDialog item={item} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Harde deadline toevoegen'));
    fireEvent.change(screen.getByLabelText('Harde deadline'), { target: { value: '2026-12-01' } });
    plannen();
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ deadline: '2026-12-01' }), expect.anything()));
  });

  it('mislukt het opslaan, dan is er niets aangemaakt en mag opnieuw proberen gewoon', async () => {
    create.mockRejectedValueOnce(new Error('netwerk'));
    const onOpenChange = vi.fn();
    render(<OpvolgingPlannenDialog item={item} onOpenChange={onOpenChange} />);
    plannen();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('er is niets opgeslagen')));
    expect(onOpenChange).not.toHaveBeenCalled();
    plannen();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('mislukt het vernieuwen na opslaan, dan maakt opnieuw proberen geen tweede taak', async () => {
    refresh.mockRejectedValueOnce(new Error('time-out'));
    const onGepland = vi.fn();
    const onOpenChange = vi.fn();
    render(<OpvolgingPlannenDialog item={item} onOpenChange={onOpenChange} onGepland={onGepland} />);
    plannen();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('geen tweede taak')));
    expect(onOpenChange).not.toHaveBeenCalled();
    plannen();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(create).toHaveBeenCalledTimes(1);
    expect(onGepland).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('een nieuw object in het venster begint weer schoon', async () => {
    refresh.mockRejectedValueOnce(new Error('time-out'));
    const { rerender } = render(<OpvolgingPlannenDialog item={item} onOpenChange={vi.fn()} />);
    plannen();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    rerender(<OpvolgingPlannenDialog item={{ ...item, objectId: 'obj-2', titel: 'Object B' }} onOpenChange={vi.fn()} />);
    plannen();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ objectId: 'obj-2' }), expect.anything());
  });
});
