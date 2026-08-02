// V31 — legacy ScrollToTopButton is bewust uitgeschakeld.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScrollToTopButton from '@/components/ScrollToTopButton';

describe('ScrollToTopButton — uitgefaseerde compatibiliteitscomponent', () => {
  it('rendert geen tweede terug-naar-bovenknop naast DynamicSectionNavigator', () => {
    const { container } = render(<ScrollToTopButton />);

    expect(screen.queryByRole('button', { name: /naar boven/i })).toBeNull();
    expect(container.innerHTML).toBe('');
  });
});
