// V2.1 — bij >3 open taken toont blok 3 + "+ N meer"
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VolgendeActiesBlok from '@/components/offmarket/cockpit/VolgendeActiesBlok';
import type { Taak } from '@/data/mock-data';

function taak(id: string, deadline: string): Taak {
  return {
    id, titel: `Opvolgtaak ${id}`,
    type: 'Follow-up', status: 'open', deadline,
    prioriteit: 'normaal', offMarketSignaalId: 's1', notities: '',
  } as any;
}

describe('VolgendeActiesBlok — overflow', () => {
  it('toont 3 items + "+ 2 meer opvolgingen" bij 5 taken', () => {
    const taken = [
      taak('a', '2026-07-01'),
      taak('b', '2026-07-02'),
      taak('c', '2026-07-03'),
      taak('d', '2026-07-04'),
      taak('e', '2026-07-05'),
    ];
    render(
      <MemoryRouter>
        <VolgendeActiesBlok signaalId="s1" taken={taken} brieven={[]} />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId('volgende-actie-item')).toHaveLength(3);
    const meer = screen.getByTestId('volgende-acties-meer');
    expect(meer.textContent).toMatch(/\+\s*2\s*meer/);
  });
});
