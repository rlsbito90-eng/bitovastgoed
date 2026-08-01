import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectenCasesSectie from '@/components/vastgoedrekenen/workspace/ProjectenCasesSectie';
import type { OverviewCalculation } from '@/components/vastgoedrekenen/workspace/types';

const item = {
  id: 'calc-1',
  object_id: 'obj-1',
  calculation_name: 'Basis quickscan',
  status: 'concept',
  main_strategy: 'buy_and_hold',
  input_reliability: 'indicatief',
  object_naam: 'Testpand Den Haag',
  latest_activity_at: Date.parse('2026-01-15T10:00:00Z'),
} as unknown as OverviewCalculation;

function renderSectie() {
  return render(
    <MemoryRouter>
      <ProjectenCasesSectie items={[item]} />
    </MemoryRouter>,
  );
}

describe('Projecten & cases previewpaneel', () => {
  it('opent de preview bij klikken op een rij met de juiste links', () => {
    renderSectie();
    expect(screen.queryByTestId('vr-case-preview')).toBeNull();

    fireEvent.click(screen.getByTestId('vr-case-rij-calc-1'));

    const previews = screen.getAllByTestId('vr-case-preview');
    expect(previews.length).toBeGreaterThan(0);

    const caseLink = screen.getAllByTestId('vr-preview-open-case')[0].querySelector('a')
      ?? screen.getAllByTestId('vr-preview-open-case')[0];
    expect(caseLink.getAttribute('href')).toContain('/objecten/obj-1?tab=vastgoedrekenen&calculation=calc-1');

    const objectLink = screen.getAllByTestId('vr-preview-open-object')[0].querySelector('a')
      ?? screen.getAllByTestId('vr-preview-open-object')[0];
    expect(objectLink.getAttribute('href')).toBe('/objecten/obj-1');
  });
});
