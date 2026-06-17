import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClassificatieReadonlyCard from '@/components/offmarket/mobile/ClassificatieReadonlyCard';
import { maakTestSignaal } from './_fixture';

describe('ClassificatieReadonlyCard', () => {
  it('toont waarden readonly zonder selectvelden', () => {
    render(
      <ClassificatieReadonlyCard
        signaal={maakTestSignaal({
          assettype: 'wonen',
          potentiele_strategie: 'Uitponding',
          omschrijving: 'Eigen omschrijving',
        } as any)}
        onWijzig={() => {}}
      />,
    );
    expect(screen.getByTestId('classificatie-readonly')).toBeInTheDocument();
    expect(screen.getByText('Wonen')).toBeInTheDocument();
    expect(screen.getByText('Uitponding')).toBeInTheDocument();
    expect(screen.getByText('Eigen omschrijving')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('roept onWijzig aan bij klikken op de knop', () => {
    const onWijzig = vi.fn();
    render(<ClassificatieReadonlyCard signaal={maakTestSignaal()} onWijzig={onWijzig} />);
    fireEvent.click(screen.getByRole('button', { name: /wijzig/i }));
    expect(onWijzig).toHaveBeenCalledOnce();
  });
});
