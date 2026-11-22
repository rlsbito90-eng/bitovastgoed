// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TaskLinksPickerDialog, {
  type TaskLinkSelection, visibleTaskLinkRows,
} from '@/components/tasks/TaskLinksPickerDialog';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    relaties: [
      { id: 'r1', contactpersoon: 'Peter Mulder', bedrijfsnaam: 'VDW Vastgoed', type: 'makelaar' },
      { id: 'r2', contactpersoon: 'Olav Mulder', bedrijfsnaam: '', type: 'belegger' },
    ],
    objecten: [
      { id: 'o1', titel: '1e Sweelinckstraat 26', adres: '1e Sweelinckstraat 26', plaats: 'Den Haag' },
      { id: 'o2', titel: 'Westervoort', adres: 'Het Ambacht 72-74', plaats: 'Westervoort' },
    ],
    deals: [{ id: 'd1', objectId: 'o1', relatieId: 'r1', fase: 'Onderhandeling' }],
    contactpersonen: [],
    getObjectById: (id: string) => id === 'o1'
      ? { id: 'o1', titel: '1e Sweelinckstraat 26', plaats: 'Den Haag' } : null,
    getRelatieById: (id: string) => id === 'r1'
      ? { id: 'r1', contactpersoon: 'Peter Mulder', bedrijfsnaam: 'VDW Vastgoed' } : null,
  }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useOffMarketSignalen: () => ({ data: [{ id: 's1', titel: 'Radar-test' }] }),
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <section {...props}>{children}</section>,
  DialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <header {...props}>{children}</header>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const sample: TaskLinkSelection = {
  relatie: ['r1'], object: ['o1'], deal: ['d1'], signaal: ['s1'],
};

describe('Koppelingen: app-achtige picker met vaste acties', () => {
  it('toont Objecten en Relaties als hoofdkeuze, Deals en Radar onder Meer', () => {
    render(<TaskLinksPickerDialog open onOpenChange={vi.fn()} value={sample} onChange={vi.fn()}/>);
    const tabs = screen.getByRole('tablist', { name: 'Soort koppeling' });
    expect(within(tabs).getByRole('tab', { name: /Objecten/ })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: /Relaties/ })).toBeInTheDocument();
    expect(within(tabs).queryByRole('tab', { name: /Deals/ })).toBeNull();
    fireEvent.click(within(tabs).getByRole('tab', { name: /Meer/ }));
    expect(screen.getByRole('button', { name: 'Radar-signalen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deals' })).toBeInTheDocument();
    expect(screen.getByText('4 beschikbaar · 1 geselecteerd')).not.toBeInTheDocument();
  });

  it('annuleert selectie zonder het ouderformulier te wijzigen, past alleen bevestigd toe', () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <TaskLinksPickerDialog open onOpenChange={onOpenChange} value={sample} onChange={onChange}/>,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Westervoort' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Annuleren' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(sample.object).toEqual(['o1']);
    rerender(<TaskLinksPickerDialog open={false} onOpenChange={onOpenChange} value={sample} onChange={onChange}/>);
    rerender(<TaskLinksPickerDialog open onOpenChange={onOpenChange} value={sample} onChange={onChange}/>);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Westervoort' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toepassen · 5' }));
    expect(onChange).toHaveBeenCalledWith({
      ...sample, object: ['o1', 'o2'],
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('behoudt deals/signalen bij gewone objectselectie en ondersteunt een expliciete opslaanflow', () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();
    render(<TaskLinksPickerDialog open onOpenChange={vi.fn()} value={sample}
      onChange={onChange} onConfirm={onConfirm}/>);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Westervoort' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toepassen · 5' }));
    const value = onConfirm.mock.calls[0][0] as TaskLinkSelection;
    expect(value.object).toEqual(['o1', 'o2']);
    expect(value.deal).toEqual(['d1']);
    expect(value.signaal).toEqual(['s1']);
  });

  it('houdt geselecteerde items zichtbaar boven de limiet en zoekt over alle objecten', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: 'o' + i, title: 'Object ' + i,
      subtitle: null, search: 'Object ' + i + ' Amsterdam',
    }));
    const visible = visibleTaskLinkRows(rows, ['o99'], '');
    expect(visible[0].id).toBe('o99');
    expect(visible).toHaveLength(70);
    expect(visibleTaskLinkRows(rows, ['o99'], 'object 98').map(x => x.id)).toEqual(['o98']);
  });

  it('scheidt kop, zoekfunctie en acties van de scrollbare resultatenlijst', () => {
    const { container } = render(
      <TaskLinksPickerDialog open onOpenChange={vi.fn()} value={sample} onChange={vi.fn()}/>,
    );
    const panel = screen.getByRole('tabpanel', { name: 'Objecten' });
    expect(panel.className).toContain('overflow-y-auto');
    expect(panel.className).toContain('min-h-0');
    const search = screen.getByRole('textbox', { name: 'Zoek objecten' });
    expect(panel.contains(search)).toBe(false);
    const apply = screen.getByRole('button', { name: 'Toepassen · 4' });
    expect(panel.contains(apply)).toBe(false);
    expect(container.querySelector('[class*="safe-area-inset-bottom"]')).not.toBeNull();
  });
});
