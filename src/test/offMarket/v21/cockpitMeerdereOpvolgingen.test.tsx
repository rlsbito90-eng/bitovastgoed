// V2.1 — cockpit toont meerdere open opvolgingen
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VolgendeActiesBlok from '@/components/offmarket/cockpit/VolgendeActiesBlok';
import type { Taak } from '@/data/mock-data';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function taak(p: Partial<Taak>): Taak {
  return {
    id: p.id || 't',
    titel: p.titel || 'Taak',
    type: 'Follow-up',
    status: p.status || 'open',
    deadline: p.deadline ?? '2026-07-10',
    prioriteit: 'normaal',
    offMarketSignaalId: p.offMarketSignaalId ?? 's1',
    notities: '',
  } as any;
}

describe('VolgendeActiesBlok — meerdere opvolgingen', () => {
  it('toont 2 open taken bij 2 open opvolgingen', () => {
    const taken: Taak[] = [
      taak({ id: 't1', titel: 'Brief 2 voorbereiden / opvolgen', deadline: '2026-07-01' }),
      taak({ id: 't2', titel: 'Brief 2 voorbereiden / opvolgen', deadline: '2026-07-05' }),
    ];
    const brieven: OffMarketBrief[] = [
      { id: 'b1', signaal_id: 's1', gekoppelde_taak_id: 't1', campagne_stap: 'brief_1',
        eigenaar_naam: 'H. Jong', eigenaar_bedrijfsnaam: null,
        verzendadres: null, objectadres: null, objectomschrijving: null,
        aanhef: null, onderwerp: null, brieftekst: '', status: 'verstuurd',
        verzonden_op: null, aangemaakt_door: null, created_at: '', updated_at: '',
        archived_at: null, archived_reason: null } as any,
      { id: 'b2', signaal_id: 's1', gekoppelde_taak_id: 't2', campagne_stap: 'brief_1',
        eigenaar_naam: 'S. Jong', eigenaar_bedrijfsnaam: null,
        verzendadres: null, objectadres: null, objectomschrijving: null,
        aanhef: null, onderwerp: null, brieftekst: '', status: 'verstuurd',
        verzonden_op: null, aangemaakt_door: null, created_at: '', updated_at: '',
        archived_at: null, archived_reason: null } as any,
    ];
    render(
      <MemoryRouter>
        <VolgendeActiesBlok signaalId="s1" taken={taken} brieven={brieven} />
      </MemoryRouter>,
    );
    const items = screen.getAllByTestId('volgende-actie-item');
    expect(items).toHaveLength(2);
    expect(screen.getByText('H. Jong')).toBeInTheDocument();
    expect(screen.getByText('S. Jong')).toBeInTheDocument();
    expect(screen.getByText(/Volgende acties/)).toBeInTheDocument();
  });
});
